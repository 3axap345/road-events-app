import { describe, expect, it } from 'vitest';

import { buildReportMapInteractions, reduceReportLocation, type ReportLocationState } from '../../../src/features/map/report-location';

const point = { latitude: 42.87, longitude: 74.59 };
const idle: ReportLocationState = { kind: 'idle', coordinate: null, eventType: null };

describe('report location selection', () => {
  it('starts type selection directly from an idle map long press', () => {
    expect(reduceReportLocation(idle, { type: 'long-press', coordinate: point })).toEqual({
      kind: 'choosing-type', coordinate: point, eventType: null
    });
  });

  it('does not move the coordinate in final confirmation or while submitting', () => {
    for (const kind of ['ready', 'submitting'] as const) {
      const state: ReportLocationState = { kind, coordinate: point, eventType: 'accident' };
      expect(reduceReportLocation(state, { type: 'long-press', coordinate: { latitude: 0, longitude: 0 } })).toEqual(state);
    }
  });

  it('replaces the draft coordinate on another long press', () => {
    const first = reduceReportLocation({ kind: 'choosing-type', coordinate: point, eventType: 'accident' }, { type: 'long-press', coordinate: point });
    expect(first.coordinate).toEqual(point);
    expect(reduceReportLocation(first, { type: 'long-press', coordinate: { latitude: 42.9, longitude: 74.6 } })).toEqual({
      kind: 'choosing-type', coordinate: { latitude: 42.9, longitude: 74.6 }, eventType: 'accident'
    });
  });

  it('binds reporting only to long press and preserves marker selection', () => {
    let state: ReportLocationState = idle;
    let selectedId: string | null = null;
    const handlers = buildReportMapInteractions(state, (action) => { state = reduceReportLocation(state, action); }, (id) => { selectedId = id; });
    expect('onPress' in handlers).toBe(false);
    handlers.onMarkerPress?.('existing-event');
    expect(selectedId).toBe('existing-event');
    expect(state).toEqual(idle);
    handlers.onMapLongPress?.(point);
    expect(state).toEqual({ kind: 'choosing-type', coordinate: point, eventType: null });
    handlers.onMarkerPress?.('another-event');
    expect(selectedId).toBe('another-event');
    expect(state.coordinate).toEqual(point);
  });

  it.each(['choosing-type', 'ready'] as const)('cancels %s and clears the draft', (kind) => {
    expect(reduceReportLocation({ kind, coordinate: point, eventType: 'accident' }, { type: 'cancel' })).toEqual(idle);
  });

  it('selects one type and replaces it when another is chosen', () => {
    const first = reduceReportLocation({ kind: 'choosing-type', coordinate: point, eventType: null }, { type: 'select-type', eventType: 'road_check' });
    expect(first).toEqual({ kind: 'choosing-type', coordinate: point, eventType: 'road_check' });
    expect(reduceReportLocation(first, { type: 'select-type', eventType: 'road_closure' })).toEqual({ kind: 'choosing-type', coordinate: point, eventType: 'road_closure' });
  });

  it('Back from type selection cancels the draft', () => {
    expect(reduceReportLocation({ kind: 'choosing-type', coordinate: point, eventType: 'road_hazard' }, { type: 'back' })).toEqual(idle);
  });

  it('cannot confirm without a type', () => {
    const state: ReportLocationState = { kind: 'choosing-type', coordinate: point, eventType: null };
    expect(reduceReportLocation(state, { type: 'continue' })).toEqual(state);
  });

  it('confirms locally with both coordinate and type and can go back', () => {
    const ready = reduceReportLocation({ kind: 'choosing-type', coordinate: point, eventType: 'accident' }, { type: 'continue' });
    expect(ready).toEqual({ kind: 'ready', coordinate: point, eventType: 'accident' });
    expect(reduceReportLocation(ready, { type: 'back' })).toEqual({ kind: 'choosing-type', coordinate: point, eventType: 'accident' });
  });

  it('ignores type selection outside the type step', () => {
    expect(reduceReportLocation(idle, { type: 'select-type', eventType: 'accident' })).toEqual(idle);
  });

  it('finishes a ready draft, clears both fields and allows another report', () => {
    const ready: ReportLocationState = { kind: 'ready', coordinate: point, eventType: 'accident' };
    expect(reduceReportLocation(ready, { type: 'continue' })).toEqual(ready);
    const pending = reduceReportLocation(
      { kind: 'ready', coordinate: point, eventType: 'accident' },
      { type: 'submit' }
    );
    expect(reduceReportLocation(pending, { type: 'cancel' })).toEqual(pending);
    const finished = reduceReportLocation(pending, { type: 'submitted' });
    expect(finished).toEqual({ kind: 'idle', coordinate: null, eventType: null });

    expect(reduceReportLocation(finished, {
      type: 'long-press', coordinate: { latitude: 42.9, longitude: 74.6 }
    })).toEqual({
      kind: 'choosing-type', coordinate: { latitude: 42.9, longitude: 74.6 }, eventType: null
    });
  });
});
