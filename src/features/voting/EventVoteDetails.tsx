import type { RoadEvent } from '../events/types';
import { EventDetailsCard } from '../map/EventDetailsCard';
import type { EventCardModel } from '../map/map-screen-model';
import { useEventVote } from './use-event-vote';

export function EventVoteDetails({ event, model, onDismiss }: {
  event: RoadEvent;
  model: EventCardModel;
  onDismiss: () => void;
}) {
  const voting = useEventVote(event);
  return <EventDetailsCard model={model} onDismiss={onDismiss}
    voting={voting.model} onVote={voting.onVote} onRetry={voting.onRetry} />;
}
