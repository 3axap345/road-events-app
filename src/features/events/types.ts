export const ROAD_EVENT_TYPES = [
  'road_check',
  'accident',
  'road_hazard',
  'road_closure'
] as const;

export const ROAD_EVENT_STATUSES = [
  'active',
  'stale',
  'removed',
  'expired'
] as const;

export const EVENT_VOTE_TYPES = ['confirm', 'gone'] as const;

export type RoadEventType = (typeof ROAD_EVENT_TYPES)[number];
export type RoadEventStatus = (typeof ROAD_EVENT_STATUSES)[number];
export type EventVoteType = (typeof EVENT_VOTE_TYPES)[number];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RoadEvent extends Coordinates {
  id: string;
  reporterId: string;
  eventType: RoadEventType;
  status: RoadEventStatus;
  confidence: number;
  confirmationCount: number;
  goneCount: number;
  createdAt: Date;
  lastConfirmedAt: Date | null;
  expiresAt: Date;
}

export interface RoadEventCandidate extends Coordinates {
  eventType: RoadEventType;
}

export interface EventVote {
  eventId: string;
  userId: string;
  voteType: EventVoteType;
}
