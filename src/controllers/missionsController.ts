/**
 * Missions: create, list, get, accept, collect, deliver, cancel
 */

import { Request, Response, NextFunction } from 'express';
import * as MissionModel from '../models/Mission';
import * as UserModel from '../models/User';
import * as NotificationModel from '../models/Notification';
import * as TransactionModel from '../models/Transaction';
import { calculateMissionPricing } from '../utils/helpers';
import { generateMissionQR } from '../services/qrService';
import { uploadToS3 } from '../services/uploadService';
import { clampRadius } from '../services/geoService';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { PackageSize } from '../types';
import { getFirebaseAdmin } from '../config/firebase';
import { createTransferToPartner } from '../services/paymentService';
import { eurosToCents } from '../utils/helpers';

/** POST /api/missions */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'client') return next(new ForbiddenError('Clients only'));
    const {
      package_title,
      package_size,
      pickup_address,
      pickup_lat,
      pickup_lng,
      delivery_address,
      delivery_lat,
      delivery_lng,
      pickup_time_slot,
    } = req.body;

    let package_photo_url: string | undefined;
    if (req.file?.buffer) {
      package_photo_url = await uploadToS3(req.file.buffer, req.file.mimetype);
    }

    const { price, commission } = calculateMissionPricing(package_size as PackageSize);

    const mission = await MissionModel.createMission({
      client_id: req.user.userId,
      package_photo_url,
      package_title,
      package_size: package_size as PackageSize,
      pickup_address,
      pickup_lat: parseFloat(pickup_lat),
      pickup_lng: parseFloat(pickup_lng),
      delivery_address,
      delivery_lat: parseFloat(delivery_lat),
      delivery_lng: parseFloat(delivery_lng),
      pickup_time_slot,
      price,
      commission,
      qr_code: undefined,
    });

    const { qrDataUrl } = await generateMissionQR(mission.id);
    await MissionModel.updateMissionQr(mission.id, qrDataUrl);
    const updated = await MissionModel.getById(mission.id);
    res.status(201).json({ success: true, mission: updated || mission });
  } catch (e) {
    next(e);
  }
}

/** GET /api/missions – client: own missions; partner: nearby available (within 1km) */
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new NotFoundError('User not found'));
    let missions;
    if (req.user.role === 'client') {
      missions = await MissionModel.listByClientId(req.user.userId);
    } else if (req.user.role === 'partner') {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = req.query.radius ? clampRadius(Number(req.query.radius)) : 1000;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const partnerMissions = await MissionModel.listByPartnerId(req.user.userId);
        missions = partnerMissions;
      } else {
        missions = await MissionModel.listNearbyAvailable(lat, lng, radius);
      }
    } else {
      return next(new ForbiddenError('Only client or partner can list missions'));
    }
    res.json({ success: true, missions });
  } catch (e) {
    next(e);
  }
}

/** GET /api/missions/:id – include partner and client for detail view */
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mission = await MissionModel.getById(req.params.id);
    if (!mission) return next(new NotFoundError('Mission not found'));
    if (req.user) {
      const isClient = mission.client_id === req.user.userId;
      const isPartner = mission.partner_id === req.user.userId;
      if (!isClient && !isPartner && req.user.role !== 'admin') {
        return next(new ForbiddenError('Access denied'));
      }
    }
    const [partner, client] = await Promise.all([
      mission.partner_id ? UserModel.getById(mission.partner_id) : null,
      mission.client_id ? UserModel.getById(mission.client_id) : null,
    ]);
    const payload = {
      ...mission,
      partner: partner
        ? {
            id: partner.id,
            email: partner.email,
            first_name: partner.first_name,
            last_name: partner.last_name,
            role: partner.role,
          }
        : undefined,
      client: client
        ? {
            id: client.id,
            email: client.email,
            first_name: client.first_name,
            last_name: client.last_name,
            role: client.role,
          }
        : undefined,
    };
    res.json({ success: true, mission: payload });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/missions/:id/accept */
export async function accept(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'partner') return next(new ForbiddenError('Partners only'));
    const mission = await MissionModel.getById(req.params.id);
    if (!mission) return next(new NotFoundError('Mission not found'));
    if (mission.status !== 'pending') throw new BadRequestError('Mission is not available');
    const updated = await MissionModel.setPartner(mission.id, req.user.userId);
    if (!updated) return next(new NotFoundError('Mission not found or already accepted'));
    NotificationModel.create({
      user_id: mission.client_id,
      type: 'mission_accepted',
      message: `Votre colis "${mission.package_title}" a été pris en charge par un Voisin-Relais.`,
    }).catch(() => {});
    res.json({ success: true, mission: updated });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/missions/:id/collect */
export async function collect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'partner') return next(new ForbiddenError('Partners only'));
    const { qr_payload } = req.body as { qr_payload?: string };
    const mission = await MissionModel.getById(req.params.id);
    if (!mission) return next(new NotFoundError('Mission not found'));
    if (mission.partner_id !== req.user.userId) return next(new ForbiddenError('Not your mission'));
    if (mission.status !== 'accepted') throw new BadRequestError('Invalid status for collect');
    // Optional: verify qr_payload matches mission.id
    const updated = await MissionModel.updateMissionStatus(mission.id, 'collected');
    NotificationModel.create({
      user_id: mission.client_id,
      type: 'mission_collected',
      message: `Votre colis "${mission.package_title}" a été récupéré, il est en route !`,
    }).catch(() => {});
    res.json({ success: true, mission: updated });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/missions/:id/deliver – complete delivery, verify QR, trigger payment to partner */
export async function deliver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'partner') return next(new ForbiddenError('Partners only'));
    const mission = await MissionModel.getById(req.params.id);
    if (!mission) return next(new NotFoundError('Mission not found'));
    if (mission.partner_id !== req.user.userId) return next(new ForbiddenError('Not your mission'));
    if (mission.status !== 'in_transit') throw new BadRequestError('Invalid status for deliver');

    const partnerAmount = mission.price - mission.commission;
    const partner = await UserModel.getById(mission.partner_id!);
    const stripeAccountId = partner?.stripe_account_id;

    const transaction = await TransactionModel.createTransaction({
      mission_id: mission.id,
      partner_id: mission.partner_id,
      amount: partnerAmount,
      status: 'pending',
    });

    if (stripeAccountId) {
      try {
        const transferId = await createTransferToPartner({
          amountCents: eurosToCents(partnerAmount),
          stripeAccountId,
          missionId: mission.id,
        });
        if (transferId) {
          await TransactionModel.updateStatus(transaction.id, 'completed');
        }
      } catch (_) {
        // keep transaction as pending for manual handling
      }
    } else {
      await TransactionModel.updateStatus(transaction.id, 'completed');
    }

    const completedAt = new Date();
    const updated = await MissionModel.updateMissionStatus(
      mission.id,
      'delivered',
      undefined,
      completedAt
    );
    NotificationModel.create({
      user_id: mission.client_id,
      type: 'delivery_completed',
      message: `Votre colis "${mission.package_title}" a été livré avec succès !`,
    }).catch(() => {});
    res.json({ success: true, mission: updated });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/missions/:id/cancel */
export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new NotFoundError('User not found'));
    const mission = await MissionModel.getById(req.params.id);
    if (!mission) return next(new NotFoundError('Mission not found'));
    const isClient = mission.client_id === req.user.userId;
    const isPartner = mission.partner_id === req.user.userId;
    if (!isClient && !isPartner && req.user.role !== 'admin') {
      return next(new ForbiddenError('Only client, assigned partner, or admin can cancel'));
    }
    if (['delivered', 'cancelled'].includes(mission.status)) {
      throw new BadRequestError('Mission cannot be cancelled');
    }
    const updated = await MissionModel.updateMissionStatus(mission.id, 'cancelled');
    if (isClient && mission.partner_id) {
      NotificationModel.create({
        user_id: mission.partner_id,
        type: 'mission_cancelled',
        message: `La mission "${mission.package_title}" a été annulée par le client.`,
      }).catch(() => {});
    } else if (!isClient) {
      NotificationModel.create({
        user_id: mission.client_id,
        type: 'mission_cancelled',
        message: `Votre mission "${mission.package_title}" a été annulée par le Voisin-Relais.`,
      }).catch(() => {});
    }
    res.json({ success: true, mission: updated });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/missions/:id/status – e.g. partner sets in_transit after collect */
export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'partner') return next(new ForbiddenError('Partners only'));
    const { status } = req.body as { status: string };
    const mission = await MissionModel.getById(req.params.id);
    if (!mission) return next(new NotFoundError('Mission not found'));
    if (mission.partner_id !== req.user.userId) return next(new ForbiddenError('Not your mission'));
    const allowed = ['collected', 'in_transit'] as const;
    if (!allowed.includes(status as any)) throw new BadRequestError('Invalid status transition');
    const updated = await MissionModel.updateMissionStatus(mission.id, status as any);
    if (status === 'in_transit') {
      NotificationModel.create({
        user_id: mission.client_id,
        type: 'mission_in_transit',
        message: `Votre colis "${mission.package_title}" est en cours de livraison !`,
      }).catch(() => {});
    }
    res.json({ success: true, mission: updated });
  } catch (e) {
    next(e);
  }
}
