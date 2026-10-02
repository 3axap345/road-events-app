import { distanceMeters } from './event-distance';
import type { RoadEvent, RoadEventCandidate } from './types';

export type NearbyDuplicateResult =
  | { kind: 'no-duplicate' }
  | { kind: 'nearby-duplicate'; event: RoadEvent; distanceMeters: number };

export function findNearbyDuplicate(
  candidate: RoadEventCandidate,
  events: readonly RoadEvent[],
  radiusMeters: number,
  now: Date = new Date()
): NearbyDuplicateResult {
  let result: NearbyDuplicateResult = { kind: 'no-duplicate' };
  for (const event of events) {
    if (event.status !== 'active' || event.eventType !== candidate.eventType || event.expiresAt <= now) {
      continue;
    }

    const eventDistance = distanceMeters(candidate, event);

    if (eventDistance <= radiusMeters && (result.kind === 'no-duplicate'
      || eventDistance < result.distanceMeters
      || (eventDistance === result.distanceMeters && (event.createdAt < result.event.createdAt
        || (event.createdAt.getTime() === result.event.createdAt.getTime() && event.id < result.event.id))))) {
      result = {
        kind: 'nearby-duplicate',
        event,
        distanceMeters: eventDistance
      };
    }
  }

  return result;
}
