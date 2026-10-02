import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createRoadEvent, createEventMutationOptions } from '../../../src/features/events/create-event';
import { ACTIVE_EVENTS_QUERY_KEY } from '../../../src/features/events/event-repository';
import { findNearbyDuplicate } from '../../../src/features/events/event-duplicates';
import { submitReport } from '../../../src/features/map/submit-report';
import { reduceReportLocation, type ReportLocationState } from '../../../src/features/map/report-location';
import type { RoadEvent } from '../../../src/features/events/types';

const now = new Date('2026-09-28T12:00:00Z');
const id = '11111111-1111-4111-8111-111111111111';
const draft = { coordinate: { latitude: 0, longitude: 0 }, eventType: 'accident' as const };
const event: RoadEvent = {
  id, reporterId: id, eventType: 'accident', latitude: 0, longitude: 0,
  status: 'active', confidence: 0, confirmationCount: 0, goneCount: 0,
  createdAt: now, expiresAt: new Date('2026-09-28T16:00:00Z'), lastConfirmedAt: null
};

describe('duplicate prevention', () => {
  it('returns a typed duplicate only for the structured server error', async () => {
    expect(await createRoadEvent({ getUserId: async () => id, insert: async () => ({
      error: { code: 'P1501', message: 'Nearby road event already exists', details: JSON.stringify({ existing_event_id: id }) }
    }) }, draft)).toEqual({ kind: 'duplicate', existingEventId: id });
  });

  it('invalidates the map after a duplicate without retrying the insert', async () => {
    const client = new QueryClient(); let inserts = 0;
    client.setQueryData(ACTIVE_EVENTS_QUERY_KEY, [event]);
    const mutation = client.getMutationCache().build(client, createEventMutationOptions(client, {
      getUserId: async () => id, insert: async () => { inserts++; return { error: { code: 'P1501', message: 'duplicate', details: JSON.stringify({ existing_event_id: id }) } }; }
    }));
    expect(await mutation.execute(draft)).toEqual({ kind: 'duplicate', existingEventId: id });
    expect(inserts).toBe(1);
    expect(client.getQueryState(ACTIVE_EVENTS_QUERY_KEY)?.isInvalidated).toBe(true);
    client.clear();
  });

  it.each(['not-json', '{}', '{"existing_event_id":"not-a-uuid"}'])('rejects malformed duplicate details: %s', async (details) => {
    await expect(createRoadEvent({ getUserId: async () => id, insert: async () => ({
      error: { code: 'P1501', message: 'duplicate', details }
    }) }, draft)).rejects.toThrow();
  });

  it('does not interpret an unrelated error with an event ID as a duplicate', async () => {
    await expect(createRoadEvent({ getUserId: async () => id, insert: async () => ({
      error: { code: '42501', message: 'denied', details: JSON.stringify({ existing_event_id: id }) }
    }) }, draft)).rejects.toThrow();
  });

  it('keeps the draft in a duplicate state instead of treating it as created', async () => {
    let state: ReportLocationState = { kind: 'ready', ...draft };
    await submitReport(() => state, (action) => { state = reduceReportLocation(state, action); },
      async () => ({ kind: 'duplicate', existingEventId: id }));
    expect(state).toEqual({ kind: 'duplicate', ...draft, existingEventId: id });
  });

  it.each(['stale', 'removed', 'expired'] as const)('ignores %s events', (status) => {
    expect(findNearbyDuplicate({ ...draft.coordinate, eventType: draft.eventType }, [{ ...event, status }], 150, now)).toEqual({ kind: 'no-duplicate' });
  });

  it('ignores active events at or past expiry', () => {
    expect(findNearbyDuplicate({ ...draft.coordinate, eventType: draft.eventType }, [{ ...event, expiresAt: now }], 150, now)).toEqual({ kind: 'no-duplicate' });
  });

  it('ignores another event type', () => {
    expect(findNearbyDuplicate({ ...draft.coordinate, eventType: 'road_hazard' }, [event], 150, now)).toEqual({ kind: 'no-duplicate' });
  });

  it.each([[149.99, 'nearby-duplicate'], [150, 'nearby-duplicate'], [150.01, 'no-duplicate']] as const)('checks the inclusive boundary at %s metres', (metres, kind) => {
    const latitude = metres / 6371000 * 180 / Math.PI;
    expect(findNearbyDuplicate({ latitude, longitude: 0, eventType: 'accident' }, [event], 150, now).kind).toBe(kind);
  });

  it('selects nearest, then oldest, then ID independently of input order', () => {
    const older = { ...event, id: 'a', createdAt: new Date('2026-09-28T11:00:00Z') };
    expect(findNearbyDuplicate({ ...draft.coordinate, eventType: draft.eventType }, [
      { ...event, latitude: 0.001 }, event, { ...older, id: 'b' }, older
    ], 150, now)).toMatchObject({ kind: 'nearby-duplicate', event: { id: 'a' } });
  });
});
