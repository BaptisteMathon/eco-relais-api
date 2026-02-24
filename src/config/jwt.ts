/**
 * Shared JWT configuration
 */

export const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
export const JWT_EXPIRES_IN = '7d';
