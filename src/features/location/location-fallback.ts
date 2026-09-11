import { BISHKEK_REGION } from '../../constants/regions';
import type { MapRegion } from '../map/map-types';
import type { CurrentLocationState } from './location-types';

export function resolveInitialRegion(location: CurrentLocationState): MapRegion {
  if (location.kind !== 'granted') {
    return BISHKEK_REGION;
  }

  return {
    ...BISHKEK_REGION,
    latitude: location.coordinate.latitude,
    longitude: location.coordinate.longitude
  };
}
