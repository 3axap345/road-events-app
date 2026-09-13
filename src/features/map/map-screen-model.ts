import { BISHKEK_REGION } from '../../constants/regions';
import type { RoadEvent } from '../events/types';
import type { CurrentLocationState } from '../location/location-types';
import type {
  MapCoordinate,
  MapMarker,
  MapRegion
} from './map-types';

const LOCATION_REGION_DELTA = {
  latitudeDelta: BISHKEK_REGION.latitudeDelta,
  longitudeDelta: BISHKEK_REGION.longitudeDelta
};

const EVENT_TYPE_LABELS: Record<RoadEvent['eventType'], string> = {
  road_check: 'Road check',
  accident: 'Accident',
  road_hazard: 'Road hazard',
  road_closure: 'Road closure'
};

export interface EventCardModel {
  eventType: RoadEvent['eventType'];
  title: string;
  ageLabel: string;
}

export function buildMapMarkers(
  events: readonly RoadEvent[]
): MapMarker[] {
  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    coordinate: {
      latitude: event.latitude,
      longitude: event.longitude
    },
    title: getEventTypeLabel(event.eventType)
  }));
}

export function resolveMapRegion(
  location: CurrentLocationState
): MapRegion {
  if (location.kind === 'granted') {
    return {
      latitude: location.coordinate.latitude,
      longitude: location.coordinate.longitude,
      ...LOCATION_REGION_DELTA
    };
  }

  return BISHKEK_REGION;
}

export function getUserLocationCoordinate(
  location: CurrentLocationState
): MapCoordinate | null {
  return location.kind === 'granted'
    ? location.coordinate
    : null;
}

export function getLocationFallbackNotice(
  location: CurrentLocationState
): string | null {
  if (location.kind === 'granted' || location.kind === 'loading') {
    return null;
  }

  return 'Геопозиция недоступна. Показан Бишкек.';
}

export function getSelectedEvent(
  events: readonly RoadEvent[],
  selectedEventId: string | null
): RoadEvent | null {
  if (!selectedEventId) {
    return null;
  }

  return (
    events.find((event) => event.id === selectedEventId) ??
    null
  );
}

export function buildEventCardModel(
  event: RoadEvent,
  now: Date
): EventCardModel {
  return {
    eventType: event.eventType,
    title: getEventTypeLabel(event.eventType),
    ageLabel: formatRelativeAge(event.createdAt, now)
  };
}

function getEventTypeLabel(
  eventType: RoadEvent['eventType']
): string {
  return EVENT_TYPE_LABELS[eventType];
}

function formatRelativeAge(
  date: Date,
  now: Date
): string {
  const milliseconds = Math.max(
    0,
    now.getTime() - date.getTime()
  );

  const minutes = Math.floor(
    milliseconds / (60 * 1000)
  );

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
