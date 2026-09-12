import { describe, expect, it } from 'vitest';

import { BISHKEK_REGION } from '../../../src/constants/regions';
import type { RoadEvent } from '../../../src/features/events/types';
import {
  buildEventCardModel,
  buildMapMarkers,
  getLocationFallbackNotice,
  getUserLocationCoordinate,
  getSelectedEvent,
  resolveMapRegion
} from '../../../src/features/map/map-screen-model';

const now = new Date('2026-09-11T12:00:00.000Z');

const event: RoadEvent = {
  id: 'road_hazard',
  reporterId: 'user-1',
  eventType: 'road_hazard',
  latitude: 42.8746,
  longitude: 74.5698,
  status: 'active',
  confidence: 2,
  confirmationCount: 2,
  goneCount: 0,
  createdAt: new Date('2026-09-11T11:55:00.000Z'),
  lastConfirmedAt: new Date('2026-09-11T11:58:00.000Z'),
  expiresAt: new Date('2026-09-11T16:00:00.000Z')
};

describe('map screen model', () => {
  it('converts road events to provider-neutral markers', () => {
    expect(buildMapMarkers([event])).toEqual([
      {
        id: 'road_hazard',
        coordinate: {
          latitude: 42.8746,
          longitude: 74.5698
        },
        title: 'Дорожная опасность'
      }
    ]);
  });

  it('uses current location as the map region when permission is granted', () => {
    const region = resolveMapRegion({
      kind: 'granted',
      coordinate: {
        latitude: 42.87,
        longitude: 74.59
      }
    });

    expect(region.latitude).toBe(42.87);
    expect(region.longitude).toBe(74.59);
  });

  it('uses Bishkek fallback when location permission is denied', () => {
    expect(
      resolveMapRegion({
        kind: 'denied'
      })
    ).toEqual(BISHKEK_REGION);
  });

  it('uses Bishkek fallback when location is unavailable', () => {
    expect(
      resolveMapRegion({
        kind: 'unavailable'
      })
    ).toEqual(BISHKEK_REGION);
  });

  it('returns the granted coordinate for the user location marker', () => {
    expect(
      getUserLocationCoordinate({
        kind: 'granted',
        coordinate: {
          latitude: 42.87,
          longitude: 74.59
        }
      })
    ).toEqual({
      latitude: 42.87,
      longitude: 74.59
    });
  });

  it('returns no user location marker when location is unavailable', () => {
    expect(
      getUserLocationCoordinate({
        kind: 'unavailable'
      })
    ).toBeNull();
  });

  it('shows a fallback notice when location permission is denied', () => {
    expect(
      getLocationFallbackNotice({
        kind: 'denied'
      })
    ).toBe('Геопозиция недоступна. Показан Бишкек.');
  });

  it('does not show a fallback notice when location is granted', () => {
    expect(
      getLocationFallbackNotice({
        kind: 'granted',
        coordinate: {
          latitude: 42.87,
          longitude: 74.59
        }
      })
    ).toBeNull();
  });

  it('resolves selected event by id', () => {
    expect(getSelectedEvent([event], 'road_hazard')).toEqual(event);
    expect(getSelectedEvent([event], null)).toBeNull();
    expect(getSelectedEvent([event], 'missing-event')).toBeNull();
  });

  it('builds compact metadata for the selected event', () => {
    expect(buildEventCardModel(event, now)).toEqual({
      id: 'road_hazard',
      title: 'Дорожная опасность',
      ageLabel: '5 мин назад',
      confirmationLabel: '2 подтверждения',
      lastConfirmationLabel:
        'Последнее подтверждение: 2 мин назад'
    });
  });
});
