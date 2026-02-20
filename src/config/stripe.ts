/**
 * Stripe SDK configuration for Connect (client payments + partner payouts)
 */

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.warn('STRIPE_SECRET_KEY is not set. Payment features will be disabled.');
} else {
  console.info('Stripe: configured (payments enabled).');
}

export const stripe = secretKey
  ? new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    })
  : (null as unknown as Stripe);

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

export function isStripeConfigured(): boolean {
  return Boolean(secretKey);
}
