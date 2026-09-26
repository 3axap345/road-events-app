import type { EventVoteType } from '../events/types';

export type VoteOperationState =
  | { kind: 'idle' | 'submitting' | 'refreshing' | 'refresh-error' }
  | { kind: 'submit-error'; voteType: EventVoteType };

export function createVoteController(dependencies: {
  cast(voteType: EventVoteType): Promise<void>;
  refresh(): Promise<void>;
  onChange(state: VoteOperationState): void;
}) {
  let state: VoteOperationState = { kind: 'idle' };
  const setState = (next: VoteOperationState) => {
    state = next;
    dependencies.onChange(next);
  };
  async function refresh() {
    setState({ kind: 'refreshing' });
    try {
      await dependencies.refresh();
      setState({ kind: 'idle' });
    } catch {
      setState({ kind: 'refresh-error' });
    }
  }
  return {
    getState: () => state,
    async submit(voteType: EventVoteType, selectedVote: EventVoteType | null): Promise<void> {
      if (state.kind !== 'idle' && state.kind !== 'submit-error') return;
      if (selectedVote === voteType) return;
      setState({ kind: 'submitting' }); // Synchronous: closes the double-tap window.
      try {
        await dependencies.cast(voteType);
      } catch {
        setState({ kind: 'submit-error', voteType });
        return;
      }
      await refresh();
    },
    async retryRefresh(): Promise<void> {
      if (state.kind === 'refresh-error' || state.kind === 'idle') await refresh();
    }
  };
}
