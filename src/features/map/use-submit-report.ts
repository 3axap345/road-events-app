import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getRoadEventsWriteGateway, getRoadEventLookupGateway } from '../../services/supabase/client';
import { useMapSelectionStore } from '../../stores/map-selection-store';
import { createEventMutationOptions } from '../events/create-event';
import { submitReport } from './submit-report';
import { viewDuplicate } from './view-duplicate';
import { ACTIVE_EVENTS_QUERY_KEY, getRoadEventById } from '../events/event-repository';
import type { RoadEvent } from '../events/types';

export function useSubmitReport() {
  const client = useQueryClient();
  const mutation = useMutation(createEventMutationOptions(client, getRoadEventsWriteGateway()));
  const submit = () => submitReport(
    () => useMapSelectionStore.getState().reportLocation,
    (action) => useMapSelectionStore.getState().dispatchReportLocation(action),
    mutation.mutateAsync
  );
  const viewExisting = () => viewDuplicate(
    () => useMapSelectionStore.getState().reportLocation,
    (action) => useMapSelectionStore.getState().dispatchReportLocation(action),
    async (id) => {
      // Prevent an older in-flight list read from overwriting the freshly loaded row.
      await client.cancelQueries({ queryKey: ACTIVE_EVENTS_QUERY_KEY });
      return getRoadEventById(getRoadEventLookupGateway(), id);
    },
    (event) => {
      client.setQueryData<RoadEvent[]>(ACTIVE_EVENTS_QUERY_KEY, (events = []) => [
        ...events.filter((item) => item.id !== event.id), event
      ]);
      useMapSelectionStore.getState().focusEvent(event.id, event);
    }
  );
  return { submit, viewExisting };
}
