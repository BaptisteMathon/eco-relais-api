/**
 * Stripe Connect – checkout for clients, payouts to partners
 */

import { stripe, isStripeConfigured } from '../config/stripe';
import { eurosToCents } from '../utils/helpers';
import { BadRequestError } from '../utils/errors';

const PLATFORM_COMMISSION = 20; // percent

/** Create Stripe Checkout Session for client paying mission price (client pays platform; we later transfer to partner) */
export async function createCheckoutSession(params: {
  missionId: string;
  amountEuros: number;
  clientEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  if (!isStripeConfigured() || !stripe) {
    throw new BadRequestError('Payments are not configured');
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Eco-Relais delivery #${params.missionId.slice(0, 8)}`,
            description: 'Hyperlocal package delivery',
          },
          unit_amount: eurosToCents(params.amountEuros),
        },
        quantity: 1,
      },
    ],
    customer_email: params.clientEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      mission_id: params.missionId,
    },
  });

  if (!session.url) {
    throw new BadRequestError('Could not create checkout URL');
  }
  return { url: session.url, sessionId: session.id };
}

/** Create Connect transfer to partner (after client payment captured) */
export async function createTransferToPartner(params: {
  amountCents: number;
  stripeAccountId: string;
  missionId: string;
}): Promise<string | null> {
  if (!isStripeConfigured() || !stripe) return null;
  const transfer = await stripe.transfers.create({
    amount: params.amountCents,
    currency: 'eur',
    destination: params.stripeAccountId,
    metadata: { mission_id: params.missionId },
  });
  return transfer.id;
}

/** Request payout to partner (e.g. balance to bank) – Stripe Connect payouts */
export async function createPayout(stripeAccountId: string, amountCents: number): Promise<string | null> {
  if (!isStripeConfigured() || !stripe) return null;
  const payout = await stripe.payouts.create(
    { amount: amountCents, currency: 'eur' },
    { stripeAccount: stripeAccountId }
  );
  return payout.id;
}

export { PLATFORM_COMMISSION };
