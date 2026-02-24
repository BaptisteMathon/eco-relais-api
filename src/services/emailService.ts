/**
 * Email service – verification emails (stub; integrate SendGrid/SES in production)
 */

import { logger } from '../utils/logger';

const VERIFY_BASE_URL = process.env.VERIFY_EMAIL_BASE_URL || 'https://app.eco-relais.com/verify';

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${VERIFY_BASE_URL}?token=${encodeURIComponent(token)}`;
  logger.info('Send verification email (stub)', { email, link });
  // TODO: SendGrid / AWS SES
  // await sgMail.send({ to: email, from: process.env.FROM_EMAIL, subject: 'Verify your email', html: `...${link}...` });
}

export async function sendMissionNotification(
  email: string,
  subject: string,
): Promise<void> {
  logger.info('Send mission notification (stub)', { email, subject });
  // TODO: implement
}
