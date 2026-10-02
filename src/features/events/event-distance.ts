import type { Coordinates } from './types';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(first: Coordinates, second: Coordinates): number {
  if (first.latitude === second.latitude && first.longitude === second.longitude) {
    return 0;
  }

  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  const clamped = Math.max(0, Math.min(1, haversine));
  // Match SQL nanometre rounding: avoid floating-point noise at an inclusive boundary.
  return Math.round(2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped)) * 1e9) / 1e9;
}
