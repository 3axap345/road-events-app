type RealtimeStatus =
  | 'SUBSCRIBED'
  | 'CHANNEL_ERROR'
  | 'TIMED_OUT'
  | 'CLOSED';

interface EventVoteRealtimeChannel {
  on(
    type: 'postgres_changes',
    filter: {
      event: '*';
      schema: 'public';
      table: 'event_votes';
      filter: string;
    },
    callback: () => void
  ): EventVoteRealtimeChannel;
  subscribe(
    callback?: (status: RealtimeStatus) => void
  ): EventVoteRealtimeChannel;
}

interface EventVoteRealtimeClient {
  channel(name: string): EventVoteRealtimeChannel;
  removeChannel(channel: EventVoteRealtimeChannel): unknown;
}

export function bindEventVoteRealtime(
  client: EventVoteRealtimeClient,
  eventId: string,
  refresh: () => void
) {
  const channel = client
    .channel(`event-vote-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'event_votes',
        filter: `event_id=eq.${eventId}`
      },
      refresh
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        refresh();
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
