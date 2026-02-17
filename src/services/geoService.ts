/**
 * Geospatial helpers – validate coordinates, radius (used by missions)
 */

export const MIN_RADIUS_M = 500;
export const MAX_RADIUS_M = 1000;
export const DEFAULT_RADIUS_M = 1000;

export function isValidLat(lat: number): boolean {
  return typeof lat === 'number' && lat >= -90 && lat <= 90 && !Number.isNaN(lat);
}

export function isValidLng(lng: number): boolean {
  return typeof lng === 'number' && lng >= -180 && lng <= 180 && !Number.isNaN(lng);
}

export function clampRadius(meters: number): number {
  return Math.max(MIN_RADIUS_M, Math.min(MAX_RADIUS_M, Math.round(meters)));
}
