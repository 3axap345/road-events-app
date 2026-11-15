import type { RoadEvent } from '../events/types';
import { EventDetailsCard } from '../map/EventDetailsCard';
import type { EventCardModel } from '../map/map-screen-model';
import { useEventVote } from './use-event-vote';

export function EventVoteDetails({ event, model, onDismiss, topBoundary }: {
  event: RoadEvent;
  model: EventCardModel;
  onDismiss: () => void;
  topBoundary: number;
}) {
  const voting = useEventVote(event);
  return <EventDetailsCard model={model} onDismiss={onDismiss} topBoundary={topBoundary}
    voting={voting.model} onVote={voting.onVote} onRetry={voting.onRetry} />;
}
