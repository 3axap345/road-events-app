import { describe, expect, it } from 'vitest';
import { ROAD_EVENT_TYPES } from '../../../src/features/events/types';
import { getEventMarkerVisual } from '../../../src/features/map/event-marker-visual';

describe('event marker visuals', () => {
  it.each([
    ['road_check', 'shield'], ['accident', 'collision'],
    ['road_hazard', 'warning'], ['road_closure', 'no-entry']
  ] as const)('represents %s with %s', (type, icon) => {
    expect(getEventMarkerVisual(type).icon).toBe(icon);
  });

  it('gives all domain types distinct visual identities', () => {
    const visuals = ROAD_EVENT_TYPES.map(getEventMarkerVisual);
    expect(new Set(visuals.map((v) => v.icon)).size).toBe(4);
    expect(new Set(visuals.map((v) => v.backgroundColor)).size).toBe(4);
  });

  it('falls back for a generic marker without an event type', () => {
    expect(getEventMarkerVisual(undefined).icon).toBe('generic');
  });
});
