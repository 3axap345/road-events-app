import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { parseRoadEvent } from './event-schema';
import type { RoadEvent } from './types';

export interface RoadEventsReadResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

export interface RoadEventsReadClient {
  from(table: 'road_events'): {
    select(columns: string): {
      eq(column: 'status', value: 'active'): PromiseLike<RoadEventsReadResult>;
    };
  };
}

export const ACTIVE_EVENTS_QUERY_KEY = ['road-events', 'active'] as const;
export const ACTIVE_EVENTS_STALE_TIME_MS = 30_000;

export interface RoadEventLookupGateway {
  readById(id: string): Promise<{ data: unknown; error: { message: string } | null }>;
}

/** A fresh RLS-protected lookup; the server clock determines expiry. */
export async function getRoadEventById(gateway: RoadEventLookupGateway, id: string): Promise<RoadEvent | null> {
  z.uuid().parse(id);
  const { data, error } = await gateway.readById(id);
  if (error) throw new Error(error.message);
  if (data === null) return null;
  const event = parseRoadEvent(data);
  if (event.id !== id) throw new Error('Unexpected event response');
  return event.status === 'active' ? event : null;
}

export async function getActiveEvents(
  client: RoadEventsReadClient
): Promise<RoadEvent[]> {
  const { data, error } = await client
    .from('road_events')
    .select('*')
    .eq('status', 'active'); // Expiry is enforced by server-time SELECT RLS.

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(parseRoadEvent);
}

export function activeEventsQueryOptions(
  client: RoadEventsReadClient
) {
  return queryOptions({
    queryKey: ACTIVE_EVENTS_QUERY_KEY,
    queryFn: () => getActiveEvents(client),
    staleTime: ACTIVE_EVENTS_STALE_TIME_MS
  });
}
