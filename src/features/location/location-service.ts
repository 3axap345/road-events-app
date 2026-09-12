import type {
  CurrentLocationState,
  LocationCoordinate
} from './location-types';

export interface ForegroundLocationGateway {
  requestForegroundPermissionsAsync(): Promise<{
    status: 'granted' | 'denied';
  }>;

  hasServicesEnabledAsync(): Promise<boolean>;

  getLastKnownPositionAsync(): Promise<LocationCoordinate | null>;

  getCurrentPositionAsync(): Promise<LocationCoordinate>;
}

type GrantedLocationState = Extract<
  CurrentLocationState,
  { kind: 'granted' }
>;

const LAST_KNOWN_LOCATION_OPTIONS = {
  maxAge: 60_000,
  requiredAccuracy: 250
};

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

  async getLastKnownPositionAsync() {
    const Location = await loadExpoLocation();

    const location = await Location.getLastKnownPositionAsync(
      LAST_KNOWN_LOCATION_OPTIONS
    );

    if (!location) {
      return null;
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    };
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
  gateway: ForegroundLocationGateway = expoForegroundLocationGateway,
  onCachedLocation?: (location: GrantedLocationState) => void
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

    const cachedLocation = await getCachedLocation(
      gateway,
      onCachedLocation
    );

    try {
      const coordinate =
        await gateway.getCurrentPositionAsync();

      return {
        kind: 'granted',
        coordinate
      };
    } catch (error) {
      return cachedLocation ?? toLocationError(error);
    }
  } catch (error) {
    return toLocationError(error);
  }
}

async function getCachedLocation(
  gateway: ForegroundLocationGateway,
  onCachedLocation?: (location: GrantedLocationState) => void
): Promise<GrantedLocationState | null> {
  try {
    const coordinate = await gateway.getLastKnownPositionAsync();

    if (!coordinate) {
      return null;
    }

    const location: GrantedLocationState = {
      kind: 'granted',
      coordinate
    };

    onCachedLocation?.(location);

    return location;
  } catch {
    return null;
  }
}

function toLocationError(
  error: unknown
): Extract<CurrentLocationState, { kind: 'error' }> {
  return {
    kind: 'error',
    message:
      error instanceof Error
        ? error.message
        : 'Unable to get location.'
  };
}
