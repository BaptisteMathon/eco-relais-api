/**
 * Generate unique QR codes for missions (pickup/delivery verification)
 */

import QRCode from 'qrcode';
import { generateId } from '../utils/helpers';

/** Generate a unique token and QR data URL for a mission (e.g. missionId:token) */
export async function generateMissionQR(missionId: string): Promise<{ token: string; qrDataUrl: string }> {
  const token = generateId();
  const payload = `${missionId}:${token}`;
  const qrDataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2 });
  return { token, qrDataUrl };
}

/** Verify QR payload matches expected mission (in real app you might store token in DB) */
export function verifyQRPayload(payload: string, missionId: string): boolean {
  const expectedPrefix = `${missionId}:`;
  return typeof payload === 'string' && payload.startsWith(expectedPrefix) && payload.length > expectedPrefix.length;
}
