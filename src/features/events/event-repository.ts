import { queryOptions } from '@tanstack/react-query';

import { parseRoadEvent } from './event-schema';
import type { RoadEvent } from './types';

export interface RoadEventsReadResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

export interface RoadEventsReadClient {
  from(table: 'road_events'): {
    select(columns: string): {
      eq(column: 'status', value: 'active'): {
        gt(column: 'expires_at', value: string): PromiseLike<RoadEventsReadResult>;
      };
    };
  };
}

export const ACTIVE_EVENTS_QUERY_KEY = ['road-events', 'active'] as const;
export const ACTIVE_EVENTS_STALE_TIME_MS = 30_000;

export async function getActiveEvents(
  client: RoadEventsReadClient,
  now: Date = new Date()
): Promise<RoadEvent[]> {
  const { data, error } = await client
    .from('road_events')
    .select('*')
    .eq('status', 'active')
    .gt('expires_at', now.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(parseRoadEvent);
}

export function activeEventsQueryOptions(
  client: RoadEventsReadClient,
  now: () => Date = () => new Date()
) {
  return queryOptions({
    queryKey: ACTIVE_EVENTS_QUERY_KEY,
    queryFn: () => getActiveEvents(client, now()),
    staleTime: ACTIVE_EVENTS_STALE_TIME_MS
  });
}
