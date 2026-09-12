import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMapSelectionStore } from '../../stores/map-selection-store';
import { useActiveEvents } from '../events/use-active-events';
import { useCurrentLocation } from '../location/use-current-location';
import { EventDetailsCard } from './EventDetailsCard';
import {
  buildEventCardModel,
  buildMapMarkers,
  getLocationFallbackNotice,
  getSelectedEvent,
  resolveMapRegion
} from './map-screen-model';
import { ReactNativeMapProvider } from './react-native-map-provider';

interface MapScreenProps {
  now?: () => Date;
}

export function MapScreen({
  now = () => new Date()
}: MapScreenProps) {
  const activeEventsQuery = useActiveEvents();
  const location = useCurrentLocation();

  const selectedEventId = useMapSelectionStore(
    (state) => state.selectedEventId
  );

  const selectEvent = useMapSelectionStore(
    (state) => state.selectEvent
  );

  const clearSelection = useMapSelectionStore(
    (state) => state.clearSelection
  );

  const events = useMemo(
    () => activeEventsQuery.data ?? [],
    [activeEventsQuery.data]
  );

  const markers = useMemo(
    () => buildMapMarkers(events),
    [events]
  );

  const region = resolveMapRegion(location);

  const fallbackNotice =
    getLocationFallbackNotice(location);

  const selectedEvent = getSelectedEvent(
    events,
    selectedEventId
  );

  const selectedEventCard = selectedEvent
    ? buildEventCardModel(selectedEvent, now())
    : null;

  return (
    <View style={styles.screen}>
      <ReactNativeMapProvider
        region={region}
        markers={markers}
        onMarkerPress={selectEvent}
        showsUserLocation={location.kind === 'granted'}
      />

      {fallbackNotice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {fallbackNotice}
          </Text>
        </View>
      ) : null}

      {activeEventsQuery.isError ? (
        <View style={styles.errorNotice}>
          <Text style={styles.noticeText}>
            Не удалось загрузить дорожные события.
          </Text>
        </View>
      ) : null}

      {selectedEventCard ? (
        <EventDetailsCard
          model={selectedEventCard}
          onDismiss={clearSelection}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  notice: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.86)',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  errorNotice: {
    position: 'absolute',
    top: 72,
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.86)',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  noticeText: {
    fontSize: 13,
    color: '#FFFFFF'
  }
});