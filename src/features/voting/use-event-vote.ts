import { useIsFetching, useIsMutating, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import { getEventVotesGateway } from '../../services/supabase/client';
import type { EventVoteType, RoadEvent } from '../events/types';
import { ACTIVE_EVENTS_QUERY_KEY } from '../events/event-repository';
import { buildVoteCardModel } from './vote-card-model';
import { createVoteController, type VoteOperationState } from './vote-controller';
import { eventVoteQueryOptions, refreshVoteQueries, voteMutationOptions } from './vote-repository';

// The container is keyed by event ID, so operation/error state cannot leak to
// another selected event. Server votes/counters remain in TanStack Query only.
export function useEventVote(event: RoadEvent) {
  const client = useQueryClient();
  const [gateway] = useState(getEventVotesGateway);
  const identity = useQuery({
    queryKey: ['event-vote-user'],
    queryFn: async () => z.uuid().parse(await gateway.getUserId()),
    retry: false
  });
  const userId = identity.data ?? '';
  const vote = useQuery({ ...eventVoteQueryOptions(gateway, event.id, userId), enabled: !!userId });
  const mutation = useMutation(voteMutationOptions(gateway, event.id, userId));
  const [operation, setOperation] = useState<VoteOperationState>({ kind: 'idle' });
  const controller = useMemo(() => createVoteController({
    cast: mutation.mutateAsync,
    refresh: () => refreshVoteQueries(client, event.id, userId),
    onChange: setOperation
  }), [client, event.id, userId, mutation.mutateAsync]);
  // Also guard a close/reopen of the same card while its RPC is still pending.
  const pendingWrites = useIsMutating({ mutationKey: ['cast-event-vote', event.id, userId], exact: true });
  const writes = useMutationState({
    filters: { mutationKey: ['cast-event-vote', event.id, userId], exact: true },
    select: (entry) => entry.state.status
  });
  const lastWriteSucceeded = writes.at(-1) === 'success';
  const eventsFetching = useIsFetching({ queryKey: ACTIVE_EVENTS_QUERY_KEY, exact: true });
  const eventsError = client.getQueryState(ACTIVE_EVENTS_QUERY_KEY)?.status === 'error';
  const selectedVote = vote.data?.voteType ?? null;
  const model = buildVoteCardModel(event, {
    userId: userId || null,
    selectedVote,
    loading: identity.isPending || vote.isPending || pendingWrites > 0,
    error: identity.isError || vote.isError || eventsError,
    refreshing: vote.isFetching || eventsFetching > 0,
    lastWriteSucceeded: lastWriteSucceeded && !identity.isError
  }, operation);

  const onVote = (voteType: EventVoteType) => {
    if (model.disabled || event.expiresAt.getTime() <= Date.now()) return;
    void controller.submit(voteType, selectedVote);
  };
  const onRetry = () => {
    if (identity.isError) {
      void identity.refetch();
    } else if (operation.kind === 'refresh-error' || (lastWriteSucceeded && (vote.isError || eventsError))) {
      void controller.retryRefresh();
    } else if (vote.isError || eventsError) {
      // Query error state owns failed reads; do not convert them into failed writes.
      void refreshVoteQueries(client, event.id, userId).catch(() => {});
    } else if (operation.kind === 'submit-error') {
      onVote(operation.voteType);
    }
  };
  return { model, onVote, onRetry };
}
