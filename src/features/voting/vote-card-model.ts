import type { EventVoteType, RoadEvent } from '../events/types';
import type { VoteOperationState } from './vote-controller';

export interface VoteReadState {
  userId: string | null;
  selectedVote: EventVoteType | null;
  loading: boolean;
  error: boolean;
  refreshing?: boolean;
  lastWriteSucceeded?: boolean;
}

export interface VoteCardModel {
  confirmationLabel: string;
  goneLabel: string;
  actions: { voteType: EventVoteType; label: string; selected: boolean }[];
  disabled: boolean;
  busy: boolean;
  notice: string | null;
  error: string | null;
  retryLabel: string | null;
}

export function buildVoteCardModel(
  event: RoadEvent, read: VoteReadState, operation: VoteOperationState, now: Date = new Date()
): VoteCardModel {
  const ownEvent = read.userId === event.reporterId;
  const unavailable = event.status !== 'active' || event.expiresAt.getTime() <= now.getTime();
  const busy = operation.kind === 'submitting' || operation.kind === 'refreshing' || !!read.refreshing;
  const refreshError = operation.kind === 'refresh-error' || (read.error && !!read.lastWriteSucceeded);
  const submitError = operation.kind === 'submit-error';
  return {
    confirmationLabel: `${event.confirmationCount} ${event.confirmationCount === 1 ? 'confirmation' : 'confirmations'}`,
    goneLabel: `${event.goneCount} no longer there`,
    actions: ownEvent ? [] : [
      { voteType: 'confirm', label: 'Confirm', selected: read.selectedVote === 'confirm' },
      { voteType: 'gone', label: 'No longer there', selected: read.selectedVote === 'gone' }
    ],
    disabled: ownEvent || unavailable || busy || refreshError || read.loading || read.error || !read.userId,
    busy,
    notice: ownEvent ? 'You reported this event. Others can validate it.'
      : unavailable ? 'This event is no longer open for voting.'
        : operation.kind === 'submitting' ? 'Saving vote…'
          : operation.kind === 'refreshing' || read.refreshing ? 'Updating details…'
            : read.loading ? 'Loading your vote…' : null,
    error: refreshError ? 'Vote saved. Could not refresh the details.'
      : read.error ? 'Could not load voting. Check your connection and retry.'
        : submitError ? 'Could not save your vote. It may be unavailable, or your connection may be offline.' : null,
    retryLabel: busy ? null : refreshError ? 'Retry refresh'
      : read.error ? 'Retry loading' : submitError && !unavailable && !ownEvent ? 'Retry vote' : null
  };
}
