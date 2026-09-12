import { describe, expect, it } from 'vitest';

import { reduceReportLocation, type ReportLocationState } from '../../../src/features/map/report-location';

const point = { latitude: 42.87, longitude: 74.59 };
const idle: ReportLocationState = { kind: 'idle', coordinate: null, eventType: null };

describe('report location selection', () => {
  it('starts without a coordinate and cannot continue yet', () => {
    const selecting = reduceReportLocation(idle, { type: 'start' });
    expect(selecting).toEqual({ kind: 'selecting', coordinate: null, eventType: null });
    expect(reduceReportLocation(selecting, { type: 'continue' })).toEqual(selecting);
  });

  it('ignores map selection outside report mode', () => {
    expect(reduceReportLocation(idle, { type: 'select', coordinate: point })).toEqual(idle);
  });

  it('replaces the draft coordinate on another long press', () => {
    const first = reduceReportLocation({ kind: 'selecting', coordinate: null, eventType: null }, { type: 'select', coordinate: point });
    expect(first.coordinate).toEqual(point);
    expect(reduceReportLocation(first, { type: 'select', coordinate: { latitude: 42.9, longitude: 74.6 } })).toEqual({
      kind: 'selecting', coordinate: { latitude: 42.9, longitude: 74.6 }, eventType: null
    });
  });

  it('continues locally with the selected coordinate and ignores further selection', () => {
    const next = reduceReportLocation({ kind: 'selecting', coordinate: point, eventType: null }, { type: 'continue' });
    expect(next).toEqual({ kind: 'choosing-type', coordinate: point, eventType: null });
    expect(reduceReportLocation(next, { type: 'select', coordinate: { latitude: 0, longitude: 0 } })).toEqual(next);
  });

  it.each(['selecting', 'choosing-type', 'ready'] as const)('cancels %s and clears the draft', (kind) => {
    expect(reduceReportLocation({ kind, coordinate: point, eventType: 'accident' }, { type: 'cancel' })).toEqual(idle);
    expect(reduceReportLocation(idle, { type: 'start' }).coordinate).toBeNull();
  });

  it('selects one type and replaces it when another is chosen', () => {
    const first = reduceReportLocation({ kind: 'choosing-type', coordinate: point, eventType: null }, { type: 'select-type', eventType: 'road_check' });
    expect(first).toEqual({ kind: 'choosing-type', coordinate: point, eventType: 'road_check' });
    expect(reduceReportLocation(first, { type: 'select-type', eventType: 'road_closure' })).toEqual({ kind: 'choosing-type', coordinate: point, eventType: 'road_closure' });
  });

  it('preserves coordinate and type through Back and Continue', () => {
    const selecting = reduceReportLocation({ kind: 'choosing-type', coordinate: point, eventType: 'road_hazard' }, { type: 'back' });
    expect(selecting).toEqual({ kind: 'selecting', coordinate: point, eventType: 'road_hazard' });
    expect(reduceReportLocation(selecting, { type: 'continue' })).toEqual({ kind: 'choosing-type', coordinate: point, eventType: 'road_hazard' });
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

    const restarted = reduceReportLocation(finished, { type: 'start' });
    expect(restarted).toEqual({ kind: 'selecting', coordinate: null, eventType: null });
    expect(reduceReportLocation(restarted, {
      type: 'select', coordinate: { latitude: 42.9, longitude: 74.6 }
    })).toEqual({
      kind: 'selecting', coordinate: { latitude: 42.9, longitude: 74.6 }, eventType: null
    });
  });
});
