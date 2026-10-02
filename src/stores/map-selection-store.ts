import { create } from 'zustand';

import { reduceReportLocation, type ReportLocationAction, type ReportLocationState } from '../features/map/report-location';
import type { MapCoordinate, MapFocusTarget } from '../features/map/map-types';

interface MapSelectionState {
  reportLocation: ReportLocationState;
  dispatchReportLocation: (action: ReportLocationAction) => void;
  selectedEventId: string | null;
  eventFocus: MapFocusTarget | null;
  focusEvent: (eventId: string, coordinate: MapCoordinate) => void;
  selectEvent: (eventId: string) => void;
  clearSelection: () => void;
}

export const useMapSelectionStore = create<MapSelectionState>(
  (set) => ({
    reportLocation: { kind: 'idle', coordinate: null, eventType: null },
    dispatchReportLocation: (action) => set((state) => ({
      reportLocation: reduceReportLocation(state.reportLocation, action),
      selectedEventId: action.type === 'long-press'
        && (state.reportLocation.kind === 'idle' || state.reportLocation.kind === 'choosing-type')
        ? null
        : state.selectedEventId,
      eventFocus: action.type === 'long-press' && (state.reportLocation.kind === 'idle' || state.reportLocation.kind === 'choosing-type')
        ? null : state.eventFocus
    })),
    selectedEventId: null,
    eventFocus: null,
    focusEvent: (eventId, coordinate) => set((state) => ({
      selectedEventId: eventId,
      eventFocus: { coordinate: { latitude: coordinate.latitude, longitude: coordinate.longitude }, requestId: (state.eventFocus?.requestId ?? 0) + 1 }
    })),

    selectEvent: (eventId) => {
      set({
        selectedEventId: eventId,
        eventFocus: null
      });
    },

    clearSelection: () => {
      set({
        selectedEventId: null,
        eventFocus: null
      });
    }
  })
);
