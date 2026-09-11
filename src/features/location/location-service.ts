import type {
  CurrentLocationState,
  LocationCoordinate
} from './location-types';

export interface ForegroundLocationGateway {
  requestForegroundPermissionsAsync(): Promise<{
    status: 'granted' | 'denied';
  }>;

  hasServicesEnabledAsync(): Promise<boolean>;

  getCurrentPositionAsync(): Promise<LocationCoordinate>;
}

async function loadExpoLocation() {
  return import('expo-location');
}

export const expoForegroundLocationGateway: ForegroundLocationGateway = {
  async requestForegroundPermissionsAsync() {
    const Location = await loadExpoLocation();

    const permission =
      await Location.requestForegroundPermissionsAsync();

    return {
      status: permission.granted ? 'granted' : 'denied'
    };
  },

  async hasServicesEnabledAsync() {
    const Location = await loadExpoLocation();

    return Location.hasServicesEnabledAsync();
  },

  async getCurrentPositionAsync() {
    const Location = await loadExpoLocation();

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    };
  }
};

export async function getCurrentLocation(
  gateway: ForegroundLocationGateway = expoForegroundLocationGateway
): Promise<Exclude<CurrentLocationState, { kind: 'loading' }>> {
  try {
    const permission =
      await gateway.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      return {
        kind: 'denied'
      };
    }

    const servicesEnabled =
      await gateway.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return {
        kind: 'unavailable'
      };
    }

    const coordinate =
      await gateway.getCurrentPositionAsync();

    return {
      kind: 'granted',
      coordinate
    };
  } catch (error) {
    return {
      kind: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Unable to get location.'
    };
  }
}