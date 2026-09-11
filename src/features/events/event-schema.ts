import { z } from 'zod';

import {
  ROAD_EVENT_STATUSES,
  ROAD_EVENT_TYPES,
  type RoadEvent
} from './types';

const sharedRowFields = {
  id: z.string().min(1),
  reporter_id: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: z.enum(ROAD_EVENT_STATUSES),
  gone_count: z.number().int().nonnegative(),
  created_at: z.string().datetime({ offset: true }),
  last_confirmed_at: z.string().datetime({ offset: true }).nullable(),
  expires_at: z.string().datetime({ offset: true })
};

const currentRoadEventRowSchema = z.object({
  ...sharedRowFields,
  event_type: z.enum(ROAD_EVENT_TYPES),
  confidence: z.number().int(),
  confirmation_count: z.number().int().nonnegative()
});

const legacyRoadEventRowSchema = z.object({
  ...sharedRowFields,
  type: z.enum(ROAD_EVENT_TYPES),
  confidence_score: z.number().int(),
  confirm_count: z.number().int().nonnegative()
});

export const roadEventRowSchema = z.union([
  currentRoadEventRowSchema,
  legacyRoadEventRowSchema
]);

export function parseRoadEvent(input: unknown): RoadEvent {
  const row = roadEventRowSchema.parse(input);
  const isCurrentSchema = 'event_type' in row;

  return {
    id: row.id,
    reporterId: row.reporter_id,
    eventType: isCurrentSchema ? row.event_type : row.type,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    confidence: isCurrentSchema ? row.confidence : row.confidence_score,
    confirmationCount: isCurrentSchema
      ? row.confirmation_count
      : row.confirm_count,
    goneCount: row.gone_count,
    createdAt: new Date(row.created_at),
    lastConfirmedAt: row.last_confirmed_at
      ? new Date(row.last_confirmed_at)
      : null,
    expiresAt: new Date(row.expires_at)
  };
}
