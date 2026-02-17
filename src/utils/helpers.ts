/**
 * General helpers (IDs, cents conversion, etc.)
 */

import { randomUUID } from 'crypto';

/** Generate UUID v4 for primary keys */
export function generateId(): string {
  return randomUUID();
}

/** Convert euros to cents for Stripe */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/** Convert cents to euros */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

/** Price per package size in euros */
export const PACKAGE_PRICES: Record<'small' | 'medium' | 'large', number> = {
  small: 3,
  medium: 5,
  large: 8,
};

/** Platform commission rate (20%) */
export const COMMISSION_RATE = 0.2;

/** Calculate mission price and commission */
export function calculateMissionPricing(
  packageSize: 'small' | 'medium' | 'large'
): { price: number; commission: number; partnerAmount: number } {
  const price = PACKAGE_PRICES[packageSize];
  const commission = price * COMMISSION_RATE;
  const partnerAmount = price - commission;
  return { price, commission, partnerAmount };
}
