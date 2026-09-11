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
  event: Pick<RoadEvent, 'confidence' | 'createdAt' | 'lastConfirmedAt' | 'expiresAt'>,
  now: Date,
  config: EventLifecycleConfig = EVENT_LIFECYCLE
): RoadEventStatus {
  if (event.confidence <= config.removalThreshold) {
    return 'removed';
  }

  if (isExpired(event, now)) {
    return 'expired';
  }

  const freshnessTimestamp = event.lastConfirmedAt ?? event.createdAt;

  return now.getTime() - freshnessTimestamp.getTime() >= config.staleAfterMs
    ? 'stale'
    : 'active';
}
