import type {
  MapCoordinate,
  MapRegion
} from './map-types';

export type MapLibreBounds = [
  west: number,
  south: number,
  east: number,
  north: number
];

export function regionToBounds(region: MapRegion): MapLibreBounds {
  const halfLatitudeDelta = region.latitudeDelta / 2;
  const halfLongitudeDelta = region.longitudeDelta / 2;

  return [
    region.longitude - halfLongitudeDelta,
    region.latitude - halfLatitudeDelta,
    region.longitude + halfLongitudeDelta,
    region.latitude + halfLatitudeDelta
  ];
}

export function getUserLocationCameraStop(
  userLocation?: MapCoordinate
): { center: [longitude: number, latitude: number] } | undefined {
  if (!userLocation) {
    return undefined;
  }

  return {
    center: [
      userLocation.longitude,
      userLocation.latitude
    ]
  };
}
