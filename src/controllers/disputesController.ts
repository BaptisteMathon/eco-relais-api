/**
 * Disputes: create (client/partner)
 */

import { Request, Response, NextFunction } from 'express';
import * as DisputeModel from '../models/Dispute';
import * as MissionModel from '../models/Mission';
import { ForbiddenError, NotFoundError } from '../utils/errors';

/** POST /api/disputes – raise a dispute for a mission (client or partner only) */
export async function createDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || (req.user.role !== 'client' && req.user.role !== 'partner')) {
      return next(new ForbiddenError('Clients and partners only'));
    }
    const { mission_id, reason } = req.body as { mission_id: string; reason: string };
    const mission = await MissionModel.getById(mission_id);
    if (!mission) return next(new NotFoundError('Mission not found'));
    const isClient = mission.client_id === req.user.userId;
    const isPartner = mission.partner_id === req.user.userId;
    if (!isClient && !isPartner) {
      return next(new ForbiddenError('Not your mission'));
    }
    const dispute = await DisputeModel.createDispute({
      mission_id,
      raised_by: req.user.userId,
      reason,
    });
    res.status(201).json({ success: true, dispute });
  } catch (e) {
    next(e);
  }
}
