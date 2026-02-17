/**
 * Auth: register, login, verify-email
 */

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/User';
import { UserRole } from '../types';
import { JwtPayload } from '../types';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { sendVerificationEmail } from '../services/emailService';
import { generateId } from '../utils/helpers';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SALT_ROUNDS = 12;

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function toPayload(user: { id: string; email: string; role: UserRole }): JwtPayload {
  return { userId: user.id, email: user.email, role: user.role };
}

/** POST /api/auth/register */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role, first_name, last_name, phone } = req.body as {
      email: string;
      password: string;
      role: UserRole;
      first_name: string;
      last_name: string;
      phone?: string;
    };

    const existing = await UserModel.getByEmail(email);
    if (existing) {
      throw new BadRequestError('Email already registered');
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.createUser({
      email,
      password_hash,
      role,
      first_name,
      last_name,
      phone,
    });

    const verifyToken = generateId();
    await setVerificationToken(user.id, verifyToken);
    await sendVerificationEmail(email, verifyToken);

    const payload = toPayload(user);
    const token = signToken(payload);
    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name, verified: user.verified },
    });
  } catch (e) {
    next(e);
  }
}

/** In-memory or Redis store for verification tokens (simplified; use Redis in prod) */
const verificationTokens = new Map<string, string>();

async function setVerificationToken(userId: string, token: string): Promise<void> {
  verificationTokens.set(token, userId);
}

function getUserIdByVerificationToken(token: string): string | undefined {
  return verificationTokens.get(token);
}

function clearVerificationToken(token: string): void {
  verificationTokens.delete(token);
}

/** POST /api/auth/verify-email */
export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    if (!token) throw new BadRequestError('Verification token required');
    const userId = getUserIdByVerificationToken(token);
    if (!userId) throw new UnauthorizedError('Invalid or expired verification token');
    await UserModel.updateUser(userId, { verified: true });
    clearVerificationToken(token);
    res.json({ success: true, message: 'Email verified' });
  } catch (e) {
    next(e);
  }
}

/** POST /api/auth/login */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await UserModel.getByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const payload = toPayload(user);
    const token = signToken(payload);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        verified: user.verified,
      },
    });
  } catch (e) {
    next(e);
  }
}
