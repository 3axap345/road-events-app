import { BISHKEK_REGION } from '../../constants/regions';
import type { RoadEvent } from '../events/types';
import type { CurrentLocationState } from '../location/location-types';
import type { MapMarker, MapRegion } from './map-types';

const LOCATION_REGION_DELTA = {
  latitudeDelta: BISHKEK_REGION.latitudeDelta,
  longitudeDelta: BISHKEK_REGION.longitudeDelta
};

const EVENT_TYPE_LABELS: Record<RoadEvent['eventType'], string> = {
  road_check: 'Дорожная проверка',
  accident: 'ДТП',
  road_hazard: 'Дорожная опасность',
  road_closure: 'Перекрытие дороги'
};

export interface EventCardModel {
  id: string;
  title: string;
  ageLabel: string;
  confirmationLabel: string;
  lastConfirmationLabel: string | null;
}

export function buildMapMarkers(
  events: readonly RoadEvent[]
): MapMarker[] {
  return events.map((event) => ({
    id: event.id,
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
    id: event.id,
    title: getEventTypeLabel(event.eventType),
    ageLabel: formatRelativeAge(event.createdAt, now),
    confirmationLabel: formatConfirmationCount(
      event.confirmationCount
    ),
    lastConfirmationLabel: event.lastConfirmedAt
      ? `Последнее подтверждение: ${formatRelativeAge(
          event.lastConfirmedAt,
          now
        )}`
      : null
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
    return 'только что';
  }

  if (minutes < 60) {
    return `${minutes} мин назад`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ч назад`;
  }

  const days = Math.floor(hours / 24);

  return `${days} дн назад`;
}

function formatConfirmationCount(
  count: number
): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return `${count} подтверждение`;
  }

  if (
    [2, 3, 4].includes(count % 10) &&
    ![12, 13, 14].includes(count % 100)
  ) {
    return `${count} подтверждения`;
  }

  return `${count} подтверждений`;
}
