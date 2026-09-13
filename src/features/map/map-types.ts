import type { RoadEventType } from '../events/types';

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends MapCoordinate {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapMarker {
  eventType?: RoadEventType;
  id: string;
  coordinate: MapCoordinate;
  title: string;
  description?: string;
}

export interface MapProviderProps {
  region: MapRegion;
  markers: readonly MapMarker[];
  userLocation?: MapCoordinate;
  draftLocation?: MapCoordinate;
  onMapLongPress?: (coordinate: MapCoordinate) => void;
  onMarkerPress?: (markerId: string) => void;
  showsUserLocation?: boolean;
}
