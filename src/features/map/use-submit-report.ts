import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getRoadEventsWriteGateway } from '../../services/supabase/client';
import { useMapSelectionStore } from '../../stores/map-selection-store';
import { createEventMutationOptions } from '../events/create-event';
import { submitReport } from './submit-report';

export function useSubmitReport() {
  const client = useQueryClient();
  const mutation = useMutation(createEventMutationOptions(client, getRoadEventsWriteGateway()));
  return () => submitReport(
    () => useMapSelectionStore.getState().reportLocation,
    (action) => useMapSelectionStore.getState().dispatchReportLocation(action),
    mutation.mutateAsync
  );
}
