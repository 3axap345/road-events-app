import { beforeEach, describe, expect, it } from 'vitest';
import { useMapSelectionStore } from '../../../src/stores/map-selection-store';
import { buildReportMapInteractions } from '../../../src/features/map/report-location';

describe('event details selection', () => {
  beforeEach(() => useMapSelectionStore.setState({ selectedEventId: null, reportLocation: { kind: 'idle', coordinate: null, eventType: null } }));

  it('selects and switches permanent events through the map contract', () => {
    const store = useMapSelectionStore.getState();
    const handlers = buildReportMapInteractions(store.reportLocation, store.dispatchReportLocation, store.selectEvent);
    handlers.onMarkerPress?.('first');
    expect(useMapSelectionStore.getState().selectedEventId).toBe('first');
    handlers.onMarkerPress?.('second');
    expect(useMapSelectionStore.getState().selectedEventId).toBe('second');
  });

  it('closing details preserves a report draft', () => {
    const store = useMapSelectionStore.getState();
    store.dispatchReportLocation({ type: 'long-press', coordinate: { latitude: 42.87, longitude: 74.59 } });
    store.dispatchReportLocation({ type: 'select-type', eventType: 'accident' });
    const draft = useMapSelectionStore.getState().reportLocation;
    store.selectEvent('event');
    store.clearSelection();
    expect(useMapSelectionStore.getState().selectedEventId).toBeNull();
    expect(useMapSelectionStore.getState().reportLocation).toEqual(draft);
  });

  it('starting a report closes details and starts the existing draft flow', () => {
    const store = useMapSelectionStore.getState();
    store.selectEvent('event');
    buildReportMapInteractions(store.reportLocation, store.dispatchReportLocation, store.selectEvent).onMapLongPress?.({ latitude: 42.87, longitude: 74.59 });
    expect(useMapSelectionStore.getState().selectedEventId).toBeNull();
    expect(useMapSelectionStore.getState().reportLocation).toEqual({ kind: 'choosing-type', coordinate: { latitude: 42.87, longitude: 74.59 }, eventType: null });
  });
});
