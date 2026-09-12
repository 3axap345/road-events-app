import { create } from 'zustand';

import { reduceReportLocation, type ReportLocationAction, type ReportLocationState } from '../features/map/report-location';

interface MapSelectionState {
  reportLocation: ReportLocationState;
  dispatchReportLocation: (action: ReportLocationAction) => void;
  selectedEventId: string | null;
  selectEvent: (eventId: string) => void;
  clearSelection: () => void;
}

export const useMapSelectionStore = create<MapSelectionState>(
  (set) => ({
    reportLocation: { kind: 'idle', coordinate: null, eventType: null },
    dispatchReportLocation: (action) => set((state) => ({
      reportLocation: reduceReportLocation(state.reportLocation, action)
    })),
    selectedEventId: null,

    selectEvent: (eventId) => {
      set({
        selectedEventId: eventId
      });
    },

    clearSelection: () => {
      set({
        selectedEventId: null
      });
    }
  })
);
