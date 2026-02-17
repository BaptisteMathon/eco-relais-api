/**
 * Notifications: send (admin), mark read, list (by user)
 */

import { Request, Response, NextFunction } from 'express';
import * as NotificationModel from '../models/Notification';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { getFirebaseAdmin } from '../config/firebase';

/** POST /api/notifications/send – Admin sends notification to user(s) */
export async function send(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') return next(new ForbiddenError('Admin only'));
    const { user_id, user_ids, type, message } = req.body as {
      user_id?: string;
      user_ids?: string[];
      type: string;
      message: string;
    };
    const ids = user_ids && user_ids.length ? user_ids : user_id ? [user_id] : [];
    if (!ids.length || !type || !message) {
      return next(new BadRequestError('user_id or user_ids, type, and message required'));
    }
    const notifications = [];
    for (const uid of ids) {
      const n = await NotificationModel.create({ user_id: uid, type, message });
      notifications.push(n);
      const app = getFirebaseAdmin();
      if (app) {
        // Optional: send FCM to user device tokens (would need token storage per user)
        // await app.messaging().send({ token: ..., notification: { title: type, body: message } });
      }
    }
    res.status(201).json({ success: true, notifications });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/notifications/:id/read */
export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new NotFoundError('User not found'));
    const n = await NotificationModel.getById(req.params.id);
    if (!n) return next(new NotFoundError('Notification not found'));
    if (n.user_id !== req.user.userId) return next(new ForbiddenError('Not your notification'));
    const updated = await NotificationModel.markAsRead(req.params.id, req.user.userId);
    res.json({ success: true, notification: updated });
  } catch (e) {
    next(e);
  }
}

/** GET /api/notifications – List current user's notifications */
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new NotFoundError('User not found'));
    const notifications = await NotificationModel.listByUserId(req.user.userId);
    res.json({ success: true, notifications });
  } catch (e) {
    next(e);
  }
}
