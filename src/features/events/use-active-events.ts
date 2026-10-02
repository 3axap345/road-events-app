import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  getRoadEventsReadClient,
  getSupabaseClient
} from '../../services/supabase/client';
import { bindActiveEventsRefresh } from './active-events-refresh';
import {
  activeEventsQueryOptions,
  type RoadEventsReadClient
} from './event-repository';
import { bindRoadEventsRealtime } from './road-events-realtime';

export function useActiveEvents(client: RoadEventsReadClient = getRoadEventsReadClient()) {
  const query = useQuery(activeEventsQueryOptions(client));
  const { refetch } = query;

  useEffect(() => bindActiveEventsRefresh(AppState, () => {
    // Keep an in-flight read; query errors remain available to the existing UI.
    void refetch({ cancelRefetch: false });
  }), [refetch]);

  useEffect(() => bindRoadEventsRealtime(getSupabaseClient(), () => {
    void refetch({ cancelRefetch: false });
  }), [refetch]);

  return query;
}
