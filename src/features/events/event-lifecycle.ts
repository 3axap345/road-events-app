import { EVENT_LIFECYCLE, type EventLifecycleConfig } from './constants';
import type { EventVoteType, RoadEvent, RoadEventStatus } from './types';

export function calculateConfidence(
  currentConfidence: number,
  voteType: EventVoteType,
  config: EventLifecycleConfig = EVENT_LIFECYCLE
): number {
  return currentConfidence +
    (voteType === 'confirm'
      ? config.confirmationConfidenceDelta
      : config.goneConfidenceDelta);
}

export function isExpired(event: Pick<RoadEvent, 'expiresAt'>, now: Date): boolean {
  return event.expiresAt.getTime() <= now.getTime();
}

export function getEventState(
  event: Pick<RoadEvent, 'status' | 'confirmationCount' | 'goneCount' | 'expiresAt'>,
  now: Date
): RoadEventStatus {
  // Testable mirror only: persisted transitions are owned by PostgreSQL.
  if (event.status === 'removed' || event.status === 'expired') return event.status;

  if (isExpired(event, now)) {
    return 'expired';
  }

  if (event.status === 'active' && event.goneCount >= 3 && event.goneCount > event.confirmationCount) {
    return 'removed';
  }
  return event.status;
}
