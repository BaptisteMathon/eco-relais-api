/**
 * Payments: Stripe checkout, webhook, partner earnings, payout
 */

import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET, isStripeConfigured } from '../config/stripe';
import { createCheckoutSession, createTransferToPartner } from '../services/paymentService';
import * as MissionModel from '../models/Mission';
import * as TransactionModel from '../models/Transaction';
import * as UserModel from '../models/User';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { centsToEuros, eurosToCents } from '../utils/helpers';

/** POST /api/payments/create-checkout */
export async function createCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'client') return next(new ForbiddenError('Clients only'));
    const { mission_id, success_url, cancel_url } = req.body as {
      mission_id: string;
      success_url?: string;
      cancel_url?: string;
    };
    const mission = await MissionModel.getById(mission_id);
    if (!mission) return next(new NotFoundError('Mission not found'));
    if (mission.client_id !== req.user.userId) return next(new ForbiddenError('Not your mission'));
    if (mission.status !== 'pending' && mission.partner_id) {
      throw new BadRequestError('Mission already paid or in progress');
    }

    const user = await UserModel.getById(req.user.userId);
    if (!user) return next(new NotFoundError('User not found'));

    const { url, sessionId } = await createCheckoutSession({
      missionId: mission_id,
      amountEuros: mission.price,
      clientEmail: user.email,
      successUrl: success_url || `${process.env.DASHBOARD_URL || 'https://app.eco-relais.com'}/missions/${mission_id}?success=1`,
      cancelUrl: cancel_url || `${process.env.DASHBOARD_URL || 'https://app.eco-relais.com'}/missions`,
    });
    res.json({ success: true, url, session_id: sessionId });
  } catch (e) {
    next(e);
  }
}

/** POST /api/payments/webhook – Stripe webhook (raw body required) */
export async function webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sig = req.headers['stripe-signature'] as string;
    if (!STRIPE_WEBHOOK_SECRET || !sig) {
      res.status(400).send('Webhook secret or signature missing');
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe!.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const missionId = session.metadata?.mission_id;
      if (missionId) {
        // Optionally store payment_intent and mark mission as paid; create transaction when partner delivers
        // Here we only acknowledge; actual transfer happens on deliver
      }
    }
    res.json({ received: true });
  } catch (e) {
    next(e);
  }
}

/** GET /api/payments/earnings – Partner earnings dashboard */
export async function earnings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'partner') return next(new ForbiddenError('Partners only'));
    const total = await TransactionModel.sumPartnerEarnings(req.user.userId);
    const transactions = await TransactionModel.listByPartnerId(req.user.userId);
    res.json({
      success: true,
      total_earnings: total,
      transactions: transactions.map((t) => ({
        id: t.id,
        mission_id: t.mission_id,
        amount: t.amount,
        status: t.status,
        created_at: t.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
}

/** POST /api/payments/payout – Request payout to partner (transfer to Connect account) */
export async function payout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'partner') return next(new ForbiddenError('Partners only'));
    const user = await UserModel.getById(req.user.userId);
    if (!user?.stripe_account_id) throw new BadRequestError('Stripe Connect account not linked');
    const balance = await TransactionModel.sumPartnerEarnings(req.user.userId);
    if (balance <= 0) throw new BadRequestError('No balance to payout');
    const amountCents = eurosToCents(balance);
    const payoutId = await createTransferToPartner({
      amountCents,
      stripeAccountId: user.stripe_account_id,
      missionId: 'payout',
    });
    if (!payoutId) throw new BadRequestError('Payout not configured');
    res.json({ success: true, payout_id: payoutId, amount: balance });
  } catch (e) {
    next(e);
  }
}
