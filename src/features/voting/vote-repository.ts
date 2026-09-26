import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { ACTIVE_EVENTS_QUERY_KEY } from '../events/event-repository';
import { EVENT_VOTE_TYPES, type EventVote, type EventVoteType } from '../events/types';

const voteRowSchema = z.object({
  event_id: z.uuid(), user_id: z.uuid(), vote_type: z.enum(EVENT_VOTE_TYPES)
});
const voteInputSchema = z.object({ p_event_id: z.uuid(), p_vote_type: z.enum(EVENT_VOTE_TYPES) }).strict();
interface GatewayError { message: string; code?: string }

export interface EventVotesGateway {
  getUserId(): Promise<string>;
  read(eventId: string, userId: string): Promise<{ data: unknown; error: GatewayError | null }>;
  cast(input: z.infer<typeof voteInputSchema>): Promise<{ error: GatewayError | null }>;
}

export const eventVoteQueryKey = (eventId: string, userId: string) => ['event-vote', eventId, userId] as const;

export function eventVoteQueryOptions(gateway: EventVotesGateway, eventId: string, userId: string) {
  return queryOptions({
    queryKey: eventVoteQueryKey(eventId, userId),
    retry: false,
    queryFn: async (): Promise<EventVote | null> => {
      z.uuid().parse(eventId);
      z.uuid().parse(userId);
      const { data, error } = await gateway.read(eventId, userId);
      if (error) throw new Error('Could not load your vote. Please retry.');
      if (data === null) return null;
      const row = voteRowSchema.parse(data);
      if (row.event_id !== eventId || row.user_id !== userId) throw new Error('Unexpected vote response.');
      return { eventId: row.event_id, userId: row.user_id, voteType: row.vote_type };
    }
  });
}

export async function castEventVote(
  gateway: EventVotesGateway, eventId: string, userId: string, voteType: EventVoteType
): Promise<void> {
  const input = voteInputSchema.parse({ p_event_id: eventId, p_vote_type: voteType });
  const authenticatedId = z.uuid().parse(await gateway.getUserId());
  if (authenticatedId !== userId) throw new Error('Your session changed. Reopen the event and try again.');
  const { error } = await gateway.cast(input);
  if (error) {
    throw new Error(error.code === '42501'
      ? 'Voting is unavailable for this event or account.'
      : 'Could not save your vote. Check your connection and retry.');
  }
}

export function voteMutationOptions(gateway: EventVotesGateway, eventId: string, userId: string) {
  return mutationOptions({
    mutationKey: ['cast-event-vote', eventId, userId],
    mutationFn: (voteType: EventVoteType) => castEventVote(gateway, eventId, userId, voteType),
    retry: false
  });
}

export async function refreshVoteQueries(client: QueryClient, eventId: string, userId: string): Promise<void> {
  // Wait for BOTH reads, even if one fails. A later retry only re-runs this function.
  const results = await Promise.allSettled([
    client.invalidateQueries({ queryKey: eventVoteQueryKey(eventId, userId), exact: true, refetchType: 'all' }, { throwOnError: true }),
    client.invalidateQueries({ queryKey: ACTIVE_EVENTS_QUERY_KEY, exact: true, refetchType: 'all' }, { throwOnError: true })
  ]);
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Vote saved, but the latest details could not be loaded.');
  }
}
