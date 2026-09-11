import { useQuery } from '@tanstack/react-query';

import { getRoadEventsReadClient } from '../../services/supabase/client';
import {
  activeEventsQueryOptions,
  type RoadEventsReadClient
} from './event-repository';

export function useActiveEvents(client: RoadEventsReadClient = getRoadEventsReadClient()) {
  return useQuery(activeEventsQueryOptions(client));
}
