import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { castEventVote, eventVoteQueryOptions, voteMutationOptions, refreshVoteQueries, type EventVotesGateway } from '../../../src/features/voting/vote-repository';
import { ACTIVE_EVENTS_QUERY_KEY } from '../../../src/features/events/event-repository';

const eventId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
function gateway(): EventVotesGateway {
  return {
    getUserId: async () => userId,
    read: async () => ({ data: null, error: null }),
    cast: async () => ({ error: null })
  };
}

describe('event vote repository', () => {
  it.each(['confirm', 'gone'] as const)('casts %s with exactly the RPC arguments, never user_id', async (voteType) => {
    const cast = vi.fn().mockResolvedValue({ error: null });
    await castEventVote({ ...gateway(), cast }, eventId, userId, voteType);
    expect(cast).toHaveBeenCalledExactlyOnceWith({ p_event_id: eventId, p_vote_type: voteType });
  });

  it('waits for authentication and rejects missing/changed identity without writing', async () => {
    const cast = vi.fn();
    await expect(castEventVote({ ...gateway(), getUserId: async () => '', cast }, eventId, userId, 'confirm')).rejects.toThrow();
    await expect(castEventVote({ ...gateway(), getUserId: async () => eventId, cast }, eventId, userId, 'confirm')).rejects.toThrow();
    await expect(castEventVote({ ...gateway(), getUserId: async () => { throw new Error('auth pending'); }, cast }, eventId, userId, 'confirm')).rejects.toThrow();
    expect(cast).not.toHaveBeenCalled();
  });

  it('rejects invalid event input before writing and surfaces database refusal', async () => {
    const cast = vi.fn().mockResolvedValue({ error: { message: 'internal detail', code: '42501' } });
    await expect(castEventVote({ ...gateway(), cast }, 'invalid', userId, 'confirm')).rejects.toThrow();
    expect(cast).not.toHaveBeenCalled();
    await expect(castEventVote({ ...gateway(), cast }, eventId, userId, 'gone')).rejects.toThrow('Voting is unavailable');
  });

  it('keys a vote by event and user, reads only that vote, and validates external rows', async () => {
    const read = vi.fn().mockResolvedValue({ data: { event_id: eventId, user_id: userId, vote_type: 'gone' }, error: null });
    const options = eventVoteQueryOptions({ ...gateway(), read }, eventId, userId);
    expect(options.queryKey).toEqual(['event-vote', eventId, userId]);
    const client = new QueryClient();
    expect(await client.fetchQuery(options)).toEqual({ eventId, userId, voteType: 'gone' });
    expect(read).toHaveBeenCalledExactlyOnceWith(eventId, userId);
    read.mockResolvedValueOnce({ data: { event_id: eventId, user_id: userId, vote_type: 'unknown' }, error: null });
    await expect(client.fetchQuery(options)).rejects.toThrow();
    read.mockResolvedValueOnce({ data: { event_id: userId, user_id: eventId, vote_type: 'confirm' }, error: null });
    await expect(client.fetchQuery(options)).rejects.toThrow();
    client.clear();
  });

  it('treats missing vote as null and a read failure as an error, not an unselected vote', async () => {
    const client = new QueryClient();
    expect(await client.fetchQuery(eventVoteQueryOptions(gateway(), eventId, userId))).toBeNull();
    await expect(client.fetchQuery(eventVoteQueryOptions({ ...gateway(), read: async () => ({ data: null, error: { message: 'private diagnostic' } }) }, eventId, userId))).rejects.toThrow('Could not load');
    client.clear();
  });

  it('disables mutation retries even if QueryClient defaults enable them', async () => {
    const cast = vi.fn().mockResolvedValue({ error: { message: 'offline' } });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: 3 } } });
    const options = voteMutationOptions({ ...gateway(), cast }, eventId, userId);
    expect(options.retry).toBe(false);
    const mutation = client.getMutationCache().build(client, options);
    await expect(mutation.execute('confirm')).rejects.toThrow();
    expect(cast).toHaveBeenCalledOnce();
    client.clear();
  });

  it('refreshes both exact query keys, leaves other users untouched, and reports read failures', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const voteKey = ['event-vote', eventId, userId];
    const otherKey = ['event-vote', eventId, eventId];
    client.setQueryData(voteKey, null);
    client.setQueryData(otherKey, null);
    client.setQueryData(ACTIVE_EVENTS_QUERY_KEY, []);
    const readVote = vi.fn().mockResolvedValue({ voteType: 'confirm' });
    const readEvents = vi.fn().mockResolvedValue(['fresh event']);
    const vote = new QueryObserver(client, { queryKey: voteKey, queryFn: readVote });
    const events = new QueryObserver(client, { queryKey: ACTIVE_EVENTS_QUERY_KEY, queryFn: readEvents });
    const stopVote = vote.subscribe(() => {});
    const stopEvents = events.subscribe(() => {});
    await refreshVoteQueries(client, eventId, userId);
    expect(client.getQueryData(voteKey)).toEqual({ voteType: 'confirm' });
    expect(client.getQueryData(ACTIVE_EVENTS_QUERY_KEY)).toEqual(['fresh event']);
    expect(client.getQueryState(otherKey)?.isInvalidated).toBe(false);
    readVote.mockRejectedValueOnce(new Error('offline'));
    await expect(refreshVoteQueries(client, eventId, userId)).rejects.toThrow();
    expect(readEvents).toHaveBeenCalledTimes(2);
    stopVote(); stopEvents(); client.clear();
  });
});
