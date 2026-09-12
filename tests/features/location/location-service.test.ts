import { describe, expect, it, vi, type Mock } from 'vitest';

import { BISHKEK_REGION } from '../../../src/constants/regions';
import { resolveInitialRegion } from '../../../src/features/location/location-fallback';
import {
  getCurrentLocation,
  type ForegroundLocationGateway
} from '../../../src/features/location/location-service';

type MockForegroundLocationGateway = {
  requestForegroundPermissionsAsync: Mock<
    ForegroundLocationGateway['requestForegroundPermissionsAsync']
  >;
  hasServicesEnabledAsync: Mock<
    ForegroundLocationGateway['hasServicesEnabledAsync']
  >;
  getLastKnownPositionAsync: Mock<
    ForegroundLocationGateway['getLastKnownPositionAsync']
  >;
  getCurrentPositionAsync: Mock<
    ForegroundLocationGateway['getCurrentPositionAsync']
  >;
};

function createGateway(
  overrides: Partial<MockForegroundLocationGateway> = {}
): MockForegroundLocationGateway {
  return {
    requestForegroundPermissionsAsync: vi
      .fn<ForegroundLocationGateway['requestForegroundPermissionsAsync']>()
      .mockResolvedValue({ status: 'granted' }),

    hasServicesEnabledAsync: vi
      .fn<ForegroundLocationGateway['hasServicesEnabledAsync']>()
      .mockResolvedValue(true),

    getLastKnownPositionAsync: vi
      .fn<ForegroundLocationGateway['getLastKnownPositionAsync']>()
      .mockResolvedValue(null),

    getCurrentPositionAsync: vi
      .fn<ForegroundLocationGateway['getCurrentPositionAsync']>()
      .mockResolvedValue({
        latitude: 42.875,
        longitude: 74.57
      }),

    ...overrides
  };
}

describe('foreground location', () => {
  it('uses a fresh coordinate when no cached position is available', async () => {
    const gateway = createGateway();

    await expect(getCurrentLocation(gateway)).resolves.toEqual({
      kind: 'granted',
      coordinate: {
        latitude: 42.875,
        longitude: 74.57
      }
    });

    expect(
      gateway.requestForegroundPermissionsAsync
    ).toHaveBeenCalledOnce();

    expect(
      gateway.getLastKnownPositionAsync
    ).toHaveBeenCalledOnce();
  });

  it('emits a cached coordinate before replacing it with a fresh coordinate', async () => {
    let resolveFreshLocation: ((coordinate: {
      latitude: number;
      longitude: number;
    }) => void) | undefined;

    const gateway = createGateway({
      getLastKnownPositionAsync: vi
        .fn<ForegroundLocationGateway['getLastKnownPositionAsync']>()
        .mockResolvedValue({
          latitude: 42.87,
          longitude: 74.59
        }),
      getCurrentPositionAsync: vi
        .fn<ForegroundLocationGateway['getCurrentPositionAsync']>()
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveFreshLocation = resolve;
            })
        )
    });
    const onCachedLocation = vi.fn();

    const result = getCurrentLocation(gateway, onCachedLocation);

    await vi.waitFor(() => {
      expect(onCachedLocation).toHaveBeenCalledWith({
        kind: 'granted',
        coordinate: {
          latitude: 42.87,
          longitude: 74.59
        }
      });
    });

    resolveFreshLocation?.({
      latitude: 42.88,
      longitude: 74.6
    });

    await expect(result).resolves.toEqual({
      kind: 'granted',
      coordinate: {
        latitude: 42.88,
        longitude: 74.6
      }
    });
  });

  it('keeps the cached coordinate when fresh lookup fails', async () => {
    const cachedCoordinate = {
      latitude: 42.87,
      longitude: 74.59
    };
    const gateway = createGateway({
      getLastKnownPositionAsync: vi
        .fn<ForegroundLocationGateway['getLastKnownPositionAsync']>()
        .mockResolvedValue(cachedCoordinate),
      getCurrentPositionAsync: vi
        .fn<ForegroundLocationGateway['getCurrentPositionAsync']>()
        .mockRejectedValue(new Error('Fresh location lookup failed'))
    });
    const onCachedLocation = vi.fn();

    await expect(
      getCurrentLocation(gateway, onCachedLocation)
    ).resolves.toEqual({
      kind: 'granted',
      coordinate: cachedCoordinate
    });

    expect(onCachedLocation).toHaveBeenCalledWith({
      kind: 'granted',
      coordinate: cachedCoordinate
    });
  });

  it('returns denied and falls back to Bishkek when foreground permission is denied', async () => {
    const gateway = createGateway({
      requestForegroundPermissionsAsync: vi
        .fn<
          ForegroundLocationGateway['requestForegroundPermissionsAsync']
        >()
        .mockResolvedValue({ status: 'denied' })
    });

    const state = await getCurrentLocation(gateway);

    expect(state).toEqual({
      kind: 'denied'
    });

    expect(resolveInitialRegion(state)).toEqual(BISHKEK_REGION);

    expect(
      gateway.hasServicesEnabledAsync
    ).not.toHaveBeenCalled();
  });

  it('returns unavailable and falls back to Bishkek when location services are disabled', async () => {
    const gateway = createGateway({
      hasServicesEnabledAsync: vi
        .fn<ForegroundLocationGateway['hasServicesEnabledAsync']>()
        .mockResolvedValue(false)
    });

    const state = await getCurrentLocation(gateway);

    expect(state).toEqual({
      kind: 'unavailable'
    });

    expect(resolveInitialRegion(state)).toEqual(BISHKEK_REGION);

    expect(
      gateway.getCurrentPositionAsync
    ).not.toHaveBeenCalled();
  });

  it('returns an error and falls back to Bishkek when location lookup fails', async () => {
    const gateway = createGateway({
      getCurrentPositionAsync: vi
        .fn<ForegroundLocationGateway['getCurrentPositionAsync']>()
        .mockRejectedValue(
          new Error('Location lookup failed')
        )
    });

    const state = await getCurrentLocation(gateway);

    expect(state).toEqual({
      kind: 'error',
      message: 'Location lookup failed'
    });

    expect(resolveInitialRegion(state)).toEqual(BISHKEK_REGION);
  });

  it('keeps the granted coordinate as the initial map center', () => {
    expect(
      resolveInitialRegion({
        kind: 'granted',
        coordinate: {
          latitude: 42.875,
          longitude: 74.57
        }
      })
    ).toMatchObject({
      latitude: 42.875,
      longitude: 74.57
    });
  });
});
