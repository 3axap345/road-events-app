import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { bindActiveEventsRefresh } from './active-events-refresh';

import { getRoadEventsReadClient } from '../../services/supabase/client';
import {
  activeEventsQueryOptions,
  type RoadEventsReadClient
} from './event-repository';

export function useActiveEvents(client: RoadEventsReadClient = getRoadEventsReadClient()) {
  const query = useQuery(activeEventsQueryOptions(client));
  const { refetch } = query;
  useEffect(() => bindActiveEventsRefresh(AppState, () => {
    // Keep an in-flight read; query errors remain available to the existing UI.
    void refetch({ cancelRefetch: false });
  }), [refetch]);
  return query;
}
