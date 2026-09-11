export interface LocationCoordinate {
  latitude: number;
  longitude: number;
}

export type CurrentLocationState =
  | { kind: 'loading' }
  | { kind: 'granted'; coordinate: LocationCoordinate }
  | { kind: 'denied' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };
