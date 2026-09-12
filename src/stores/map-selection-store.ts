import { create } from 'zustand';

interface MapSelectionState {
  selectedEventId: string | null;
  selectEvent: (eventId: string) => void;
  clearSelection: () => void;
}

export const useMapSelectionStore = create<MapSelectionState>(
  (set) => ({
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