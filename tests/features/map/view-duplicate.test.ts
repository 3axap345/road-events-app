import { describe, expect, it, vi } from 'vitest';
import { viewDuplicate } from '../../../src/features/map/view-duplicate';
import { reduceReportLocation, type ReportLocationState } from '../../../src/features/map/report-location';
import { getRoadEventById } from '../../../src/features/events/event-repository';
import { useMapSelectionStore } from '../../../src/stores/map-selection-store';
import type { RoadEvent } from '../../../src/features/events/types';

const id = '11111111-1111-4111-8111-111111111111';
const coordinate = { latitude: 42.87, longitude: 74.59 };
const event: RoadEvent = { id, reporterId: id, ...coordinate, eventType: 'accident', status: 'active', confidence: 0,
  confirmationCount: 0, goneCount: 0, createdAt: new Date(), expiresAt: new Date(Date.now()+3600000), lastConfirmedAt: null };
function flow() {
  let state: ReportLocationState = { kind: 'duplicate', coordinate, eventType: 'accident', existingEventId: id };
  return { get: () => state, dispatch: (action: Parameters<typeof reduceReportLocation>[1]) => { state = reduceReportLocation(state, action); } };
}

describe('view an existing duplicate', () => {
  it('loads the server event, opens it once, and clears the draft', async () => {
    const state = flow(); const open = vi.fn();
    await viewDuplicate(state.get, state.dispatch, async (eventId) => {
      expect(eventId).toBe(id); expect(state.get().kind).toBe('viewing-duplicate'); return event;
    }, open);
    expect(open).toHaveBeenCalledExactlyOnceWith(event);
    expect(state.get().kind).toBe('idle');
  });
  it('returns to review when the server no longer exposes the event', async () => {
    const state = flow(); const open = vi.fn();
    await viewDuplicate(state.get, state.dispatch, async () => null, open);
    expect(state.get()).toMatchObject({ kind: 'ready', coordinate, eventType: 'accident', error: expect.any(String) });
    expect(open).not.toHaveBeenCalled();
  });
  it('retains the duplicate and draft after a failed read', async () => {
    const state = flow(); const open = vi.fn();
    await viewDuplicate(state.get, state.dispatch, async () => { throw new Error('offline'); }, open);
    expect(state.get()).toMatchObject({ kind: 'duplicate', coordinate, existingEventId: id, error: expect.any(String) });
    expect(open).not.toHaveBeenCalled();
  });
  it('does not reopen an event after the user cancels an in-flight read', async () => {
    const state = flow(); const open = vi.fn();
    let finish!: (value: RoadEvent) => void;
    const pending = viewDuplicate(state.get, state.dispatch, () => new Promise<RoadEvent>((resolve) => { finish = resolve; }), open);
    state.dispatch({ type: 'cancel' }); finish(event); await pending;
    expect(open).not.toHaveBeenCalled(); expect(state.get().kind).toBe('idle');
  });
  it('ignores a second view tap while loading', async () => {
    const state = flow(); const load = vi.fn(async () => event); const open = vi.fn();
    await Promise.all([viewDuplicate(state.get, state.dispatch, load, open), viewDuplicate(state.get, state.dispatch, load, open)]);
    expect(load).toHaveBeenCalledOnce(); expect(open).toHaveBeenCalledOnce();
  });
  it('focuses and selects the existing event through the UI store', () => {
    useMapSelectionStore.getState().focusEvent(id, coordinate);
    expect(useMapSelectionStore.getState()).toMatchObject({ selectedEventId: id, eventFocus: { coordinate } });
    useMapSelectionStore.getState().clearSelection();
    expect(useMapSelectionStore.getState().eventFocus).toBeNull();
  });
  it('returns null for RLS-hidden events and rejects mismatched responses', async () => {
    expect(await getRoadEventById({ readById: async () => ({ data: null, error: null }) }, id)).toBeNull();
    await expect(getRoadEventById({ readById: async () => ({ data: { id: 'wrong' }, error: null }) }, id)).rejects.toThrow();
    await expect(getRoadEventById({ readById: async () => ({ data: null, error: { message: 'offline' } }) }, id)).rejects.toThrow();
  });
  it('validates the returned ID and trusts server-time visibility instead of the device clock', async () => {
    const row = { id, reporter_id: id, latitude: 42.87, longitude: 74.59, event_type: 'accident', status: 'active',
      confidence: 0, confirmation_count: 0, gone_count: 0, last_confirmed_at: null,
      created_at: '2026-01-01T00:00:00Z', expires_at: '2026-01-01T04:00:00Z' };
    const gateway = { readById: async () => ({ data: row, error: null }) };
    expect(await getRoadEventById(gateway, id)).toMatchObject({ id, eventType: 'accident', latitude: 42.87 });
    await expect(getRoadEventById(gateway, '22222222-2222-4222-8222-222222222222')).rejects.toThrow('Unexpected event response');
    expect(await getRoadEventById({ readById: async () => ({ data: { ...row, status: 'removed' }, error: null }) }, id)).toBeNull();
  });
});
