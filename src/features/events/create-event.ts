import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { MapCoordinate } from '../map/map-types';
import { ACTIVE_EVENTS_QUERY_KEY } from './event-repository';
import { ROAD_EVENT_TYPES, type RoadEventType } from './types';

export interface CreateEventDraft {
  coordinate: MapCoordinate;
  eventType: RoadEventType;
}

const insertSchema = z.object({
  reporter_id: z.uuid(),
  event_type: z.enum(ROAD_EVENT_TYPES),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
}).strict();

export interface RoadEventsWriteGateway {
  getUserId(): Promise<string>;
  insert(payload: z.infer<typeof insertSchema>): Promise<{ error: { message: string } | null }>;
}

export async function createRoadEvent(gateway: RoadEventsWriteGateway, draft: CreateEventDraft): Promise<void> {
  const payload = insertSchema.parse({
    reporter_id: await gateway.getUserId(),
    event_type: draft.eventType,
    latitude: draft.coordinate.latitude,
    longitude: draft.coordinate.longitude
  });
  const { error } = await gateway.insert(payload);
  if (error) throw new Error(error.message);
}

export function createEventMutationOptions(client: QueryClient, gateway: RoadEventsWriteGateway) {
  return mutationOptions({
    mutationFn: (draft: CreateEventDraft) => createRoadEvent(gateway, draft),
    retry: false,
    // A saved insert must not be retried because a subsequent read fails.
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ACTIVE_EVENTS_QUERY_KEY, refetchType: 'active' });
    }
  });
}
