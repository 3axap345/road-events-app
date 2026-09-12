import { describe, expect, it } from 'vitest';

import { regionToBounds } from '../../../src/features/map/maplibre-region';

describe('regionToBounds', () => {
  it('converts a map region to MapLibre west-south-east-north bounds', () => {
    const bounds = regionToBounds({
      latitude: 42.8746,
      longitude: 74.5698,
      latitudeDelta: 0.1,
      longitudeDelta: 0.2
    });

    expect(bounds[0]).toBeCloseTo(74.4698);
    expect(bounds[1]).toBeCloseTo(42.8246);
    expect(bounds[2]).toBeCloseTo(74.6698);
    expect(bounds[3]).toBeCloseTo(42.9246);
  });
});