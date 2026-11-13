import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useMapSelectionStore } from '../../stores/map-selection-store';
import { useActiveEvents } from '../events/use-active-events';
import { useCurrentLocation } from '../location/use-current-location';
import { EventVoteDetails } from '../voting/EventVoteDetails';
import {
  buildEventCardModel,
  buildMapMarkers,
  getLocationFallbackNotice,
  getUserLocationCoordinate,
  getSelectedEvent,
  resolveMapRegion
} from './map-screen-model';
import { ReactNativeMapProvider } from './react-native-map-provider';
import { ReportLocationControls } from './ReportLocationControls';
import { useSubmitReport } from './use-submit-report';
import { buildReportMapInteractions } from './report-location';
import { MapChrome } from './MapChrome';
import { mapTheme } from './map-theme';

interface MapScreenProps {
  now?: () => Date;
}

export function MapScreen({
  now = () => new Date()
}: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [locationRequestId, setLocationRequestId] = useState(0);
  const activeEventsQuery = useActiveEvents();
  const location = useCurrentLocation();
  const { submit, viewExisting } = useSubmitReport();
  const eventFocus = useMapSelectionStore((state) => state.eventFocus);
  const reportLocation = useMapSelectionStore((state) => state.reportLocation);
  const dispatchReportLocation = useMapSelectionStore((state) => state.dispatchReportLocation);

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

  const userLocation = getUserLocationCoordinate(location);

  const fallbackNotice =
    getLocationFallbackNotice(location);

  const selectedEvent = getSelectedEvent(
    events,
    selectedEventId
  );

  const selectedEventCard = selectedEvent
    ? buildEventCardModel(selectedEvent, now())
    : null;
  const reporting = reportLocation.kind !== 'idle';
  const interactions = buildReportMapInteractions(reportLocation, dispatchReportLocation, selectEvent);
  const status = activeEventsQuery.isPending ? 'Загружаем дорожные события…'
    : events.length === 0 && !activeEventsQuery.isError ? 'Поблизости пока нет отметок. Удерживайте точку, чтобы добавить событие.'
      : 'Удерживайте точку на карте, чтобы добавить событие.';
  const warning = [fallbackNotice, activeEventsQuery.isError ? 'Не удалось загрузить дорожные события.' : null]
    .filter(Boolean).join('\n') || null;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ReactNativeMapProvider
        region={region}
        markers={markers}
        userLocation={userLocation ?? undefined}
        draftLocation={reportLocation.coordinate ?? undefined}
        focusTarget={eventFocus ?? undefined}
        {...interactions}
        showsUserLocation={location.kind === 'granted'}
        locationRequestId={locationRequestId}
        attributionPosition={{
          top: insets.top + mapTheme.space.large + (reporting ? 0 : headerHeight + mapTheme.space.large),
          right: insets.right + mapTheme.space.edge
        }}
      />

      <MapChrome insets={insets} status={status} warning={warning}
        showHeader={!reporting} showControls={!reporting && !selectedEvent}
        canLocate={userLocation !== null} onHeaderHeight={setHeaderHeight}
        onRecenter={() => {
          if (!userLocation) return;
          useMapSelectionStore.setState({ eventFocus: null });
          setLocationRequestId((value) => value + 1);
        }}
        onAdd={() => {
          if (userLocation) interactions.onMapLongPress?.(userLocation);
        }} />

      {selectedEvent && selectedEventCard ? (
        <EventVoteDetails
          key={selectedEvent.id}
          event={selectedEvent}
          model={selectedEventCard}
          onDismiss={clearSelection}
        />
      ) : null}
      <ReportLocationControls state={reportLocation} dispatch={dispatchReportLocation} onSubmit={submit} onViewExisting={viewExisting} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  }
});
