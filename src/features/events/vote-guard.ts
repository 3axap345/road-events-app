import type { EventVote } from './types';

export function canCastVote(
  eventId: string,
  existingVotes: readonly EventVote[]
): boolean {
  return !existingVotes.some((vote) => vote.eventId === eventId);
}