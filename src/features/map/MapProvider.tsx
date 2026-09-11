import type { ComponentType } from 'react';

import type { MapProviderProps } from './map-types';

export type MapProvider = ComponentType<MapProviderProps>;

export type {
  MapCoordinate,
  MapMarker,
  MapProviderProps,
  MapRegion
} from './map-types';
