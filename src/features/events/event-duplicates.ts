import { distanceMeters } from './event-distance';
import type { RoadEvent, RoadEventCandidate } from './types';

export type NearbyDuplicateResult =
  | { kind: 'no-duplicate' }
  | { kind: 'nearby-duplicate'; event: RoadEvent; distanceMeters: number };

export function findNearbyDuplicate(
  candidate: RoadEventCandidate,
  events: readonly RoadEvent[],
  radiusMeters: number
): NearbyDuplicateResult {
  for (const event of events) {
    if (event.status !== 'active' || event.eventType !== candidate.eventType) {
      continue;
    }

    const eventDistance = distanceMeters(candidate, event);

    if (eventDistance <= radiusMeters) {
      return {
        kind: 'nearby-duplicate',
        event,
        distanceMeters: eventDistance
      };
    }
  }

  return { kind: 'no-duplicate' };
}
