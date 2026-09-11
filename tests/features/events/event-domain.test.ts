import { describe, expect, it } from 'vitest';

import { EVENT_LIFECYCLE } from '../../../src/features/events/constants';
import { distanceMeters } from '../../../src/features/events/event-distance';
import { findNearbyDuplicate } from '../../../src/features/events/event-duplicates';
import {
  calculateConfidence,
  getEventState,
  isExpired
} from '../../../src/features/events/event-lifecycle';
import { parseRoadEvent } from '../../../src/features/events/event-schema';
import type { RoadEvent } from '../../../src/features/events/types';
import { canCastVote } from '../../../src/features/events/vote-guard';

const NOW = new Date('2026-09-11T12:00:00.000Z');

function makeEvent(overrides: Partial<RoadEvent> = {}): RoadEvent {
  return {
    id: 'event-1',
    reporterId: 'user-1',
    eventType: 'road_hazard',
    latitude: 42.8746,
    longitude: 74.5698,
    status: 'active',
    confidence: EVENT_LIFECYCLE.initialConfidence,
    confirmationCount: 0,
    goneCount: 0,
    createdAt: new Date('2026-09-11T11:55:00.000Z'),
    lastConfirmedAt: null,
    expiresAt: new Date('2026-09-11T16:00:00.000Z'),
    ...overrides
  };
}

describe('event lifecycle', () => {
  it('adds configured confidence for a confirmation', () => {
    expect(calculateConfidence(4, 'confirm')).toBe(
      4 + EVENT_LIFECYCLE.confirmationConfidenceDelta
    );
  });

  it('subtracts configured confidence for a gone vote', () => {
    expect(calculateConfidence(4, 'gone')).toBe(
      4 + EVENT_LIFECYCLE.goneConfidenceDelta
    );
  });

  it('marks an event stale after the configured freshness horizon', () => {
    const event = makeEvent({
      lastConfirmedAt: new Date(
        NOW.getTime() - EVENT_LIFECYCLE.staleAfterMs
      )
    });

    expect(getEventState(event, NOW)).toBe('stale');
  });

  it('expires an event at its expiry timestamp', () => {
    const event = makeEvent({
      expiresAt: NOW
    });

    expect(isExpired(event, NOW)).toBe(true);
    expect(getEventState(event, NOW)).toBe('expired');
  });

  it('removes an event at or below the configured removal threshold', () => {
    const event = makeEvent({
      confidence: EVENT_LIFECYCLE.removalThreshold
    });

    expect(getEventState(event, NOW)).toBe('removed');
  });
});

describe('vote guard', () => {
  it('denies a vote when the user already voted for the event', () => {
    expect(
      canCastVote('event-1', [
        {
          eventId: 'event-1',
          userId: 'user-1',
          voteType: 'confirm'
        }
      ])
    ).toBe(false);
  });

  it('allows a vote when the user has not voted for the event', () => {
    expect(
      canCastVote('event-2', [
        {
          eventId: 'event-1',
          userId: 'user-1',
          voteType: 'confirm'
        }
      ])
    ).toBe(true);
  });
});

describe('event distance and duplicates', () => {
  it('returns zero meters for coincident Bishkek coordinates', () => {
    expect(
      distanceMeters(
        {
          latitude: 42.8746,
          longitude: 74.5698
        },
        {
          latitude: 42.8746,
          longitude: 74.5698
        }
      )
    ).toBe(0);
  });

  it('matches only an active event of the same type within the radius', () => {
    const candidate = {
      eventType: 'road_hazard' as const,
      latitude: 42.8746,
      longitude: 74.5698
    };

    const nearbyMatch = makeEvent();

    const nearbyDifferentType = makeEvent({
      id: 'event-2',
      eventType: 'accident'
    });

    const nearbyInactive = makeEvent({
      id: 'event-3',
      status: 'stale'
    });

    const result = findNearbyDuplicate(
      candidate,
      [
        nearbyMatch,
        nearbyDifferentType,
        nearbyInactive
      ],
      EVENT_LIFECYCLE.duplicateRadiusMeters
    );

    expect(result.kind).toBe('nearby-duplicate');

    if (result.kind === 'nearby-duplicate') {
      expect(result.event.id).toBe('event-1');
      expect(result.distanceMeters).toBe(0);
    }
  });

  it('returns no duplicate when matching events are outside the radius', () => {
    const candidate = {
      eventType: 'road_hazard' as const,
      latitude: 42.8746,
      longitude: 74.5698
    };

    const distantEvent = makeEvent({
      latitude: 42.8846,
      longitude: 74.5798
    });

    const result = findNearbyDuplicate(
      candidate,
      [distantEvent],
      EVENT_LIFECYCLE.duplicateRadiusMeters
    );

    expect(result.kind).toBe('no-duplicate');
  });
});

describe('event parsing', () => {
  it('parses a Supabase road event row', () => {
    const event = parseRoadEvent({
      id: 'event-1',
      reporter_id: 'user-1',
      type: 'road_hazard',
      latitude: 42.8746,
      longitude: 74.5698,
      status: 'active',
      confidence_score: EVENT_LIFECYCLE.initialConfidence,
      confirm_count: 2,
      gone_count: 0,
      created_at: '2026-09-11T11:55:00.000Z',
      last_confirmed_at: '2026-09-11T11:58:00.000Z',
      expires_at: '2026-09-11T16:00:00.000Z'
    });

    expect(event.id).toBe('event-1');
    expect(event.reporterId).toBe('user-1');
    expect(event.eventType).toBe('road_hazard');
    expect(event.status).toBe('active');
    expect(event.confidence).toBe(EVENT_LIFECYCLE.initialConfidence);
    expect(event.confirmationCount).toBe(2);
    expect(event.goneCount).toBe(0);

    expect(event.createdAt).toBeInstanceOf(Date);
    expect(event.lastConfirmedAt).toBeInstanceOf(Date);
    expect(event.expiresAt).toBeInstanceOf(Date);
  });

  it('supports a null last confirmation timestamp', () => {
    const event = parseRoadEvent({
      id: 'event-2',
      reporter_id: 'user-2',
      type: 'accident',
      latitude: 42.8746,
      longitude: 74.5698,
      status: 'active',
      confidence_score: EVENT_LIFECYCLE.initialConfidence,
      confirm_count: 0,
      gone_count: 0,
      created_at: '2026-09-11T11:55:00.000Z',
      last_confirmed_at: null,
      expires_at: '2026-09-11T16:00:00.000Z'
    });

    expect(event.lastConfirmedAt).toBeNull();
  });
});