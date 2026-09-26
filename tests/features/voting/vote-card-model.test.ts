import { describe, expect, it } from 'vitest';
import type { RoadEvent } from '../../../src/features/events/types';
import { buildVoteCardModel } from '../../../src/features/voting/vote-card-model';

const now = new Date('2026-09-13T12:00:00Z');
const event: RoadEvent = {
  id: 'event', reporterId: 'reporter', eventType: 'accident', latitude: 42, longitude: 74,
  status: 'active', confidence: 0, confirmationCount: 3, goneCount: 2,
  createdAt: now, lastConfirmedAt: null, expiresAt: new Date('2026-09-13T16:00:00Z')
};
const read = { userId: 'voter', selectedVote: 'confirm' as const, loading: false, error: false };

describe('vote card model', () => {
  it('shows server counts and selected vote, with both vote choices', () => {
    const model = buildVoteCardModel(event, read, { kind: 'idle' }, now);
    expect(model.confirmationLabel).toBe('3 confirmations');
    expect(model.goneLabel).toBe('2 no longer there');
    expect(model.actions).toEqual([
      { voteType: 'confirm', label: 'Confirm', selected: true },
      { voteType: 'gone', label: 'No longer there', selected: false }
    ]);
    expect(model.disabled).toBe(false);
  });

  it('shows counts but no vote actions for the reporter', () => {
    const model = buildVoteCardModel(event, { ...read, userId: 'reporter' }, { kind: 'idle' }, now);
    expect(model.actions).toEqual([]);
    expect(model.notice).toBe('You reported this event. Others can validate it.');
    expect(model.confirmationLabel).toBe('3 confirmations');
  });

  it.each(['stale', 'removed', 'expired'] as const)('disables voting on %s events', (status) => {
    expect(buildVoteCardModel({ ...event, status }, read, { kind: 'idle' }, now).disabled).toBe(true);
  });

  it('disables an active event at its exact expiry time', () => {
    expect(buildVoteCardModel({ ...event, expiresAt: now }, read, { kind: 'idle' }, now).disabled).toBe(true);
  });

  it('disables while identity/vote is unknown or loading failed', () => {
    for (const state of [{ ...read, userId: null }, { ...read, loading: true }, { ...read, error: true }]) {
      expect(buildVoteCardModel(event, state, { kind: 'idle' }, now).disabled).toBe(true);
    }
  });

  it('keeps server counters and selection unchanged while writing or refreshing', () => {
    for (const kind of ['submitting', 'refreshing', 'refresh-error'] as const) {
      const model = buildVoteCardModel(event, read, { kind }, now);
      expect(model.disabled).toBe(true);
      expect(model.confirmationLabel).toBe('3 confirmations');
      expect(model.actions[0]?.selected).toBe(true);
    }
    expect(buildVoteCardModel(event, read, { kind: 'refresh-error' }, now).retryLabel).toBe('Retry refresh');
  });

  it('blocks stale cached selection on a reopened card during background refresh', () => {
    const model = buildVoteCardModel(event, { ...read, refreshing: true, lastWriteSucceeded: true }, { kind: 'idle' }, now);
    expect(model.disabled).toBe(true);
    expect(model.notice).toBe('Updating details…');
    expect(model.actions[0]?.selected).toBe(true); // Still server cache, never optimistic.
  });

  it('restores saved-but-refresh-failed recovery on a reopened card', () => {
    const model = buildVoteCardModel(event, { ...read, error: true, lastWriteSucceeded: true }, { kind: 'idle' }, now);
    expect(model.disabled).toBe(true);
    expect(model.retryLabel).toBe('Retry refresh');
    expect(model.error).toBe('Vote saved. Could not refresh the details.');
  });
});
