/**
 * Users: get/update profile
 */

import { Request, Response, NextFunction } from 'express';
import * as UserModel from '../models/User';
import { NotFoundError } from '../utils/errors';

/** GET /api/users/profile */
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new NotFoundError('User not found'));
    const user = await UserModel.getById(req.user.userId);
    if (!user) {
      return next(new NotFoundError('User not found'));
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        address_lat: user.address_lat,
        address_lng: user.address_lng,
        verified: user.verified,
        stripe_account_id: user.stripe_account_id ? '[REDACTED]' : null,
        created_at: user.created_at,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/users/profile */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new NotFoundError('User not found'));
    const { first_name, last_name, phone, address_lat, address_lng } = req.body;
    const user = await UserModel.updateUser(req.user.userId, {
      first_name,
      last_name,
      phone,
      address_lat,
      address_lng,
    });
    if (!user) return next(new NotFoundError('User not found'));
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        address_lat: user.address_lat,
        address_lng: user.address_lng,
        verified: user.verified,
        created_at: user.created_at,
      },
    });
  } catch (e) {
    next(e);
  }
}
