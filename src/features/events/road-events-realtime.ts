interface RoadEventsRealtimeChannel {
  on(
    type: 'postgres_changes',
    filter: {
      event: '*';
      schema: 'public';
      table: 'road_events';
    },
    callback: () => void
  ): RoadEventsRealtimeChannel;
  subscribe(): RoadEventsRealtimeChannel;
}

interface RoadEventsRealtimeClient {
  channel(name: string): RoadEventsRealtimeChannel;
  removeChannel(channel: RoadEventsRealtimeChannel): unknown;
}

export function bindRoadEventsRealtime(
  client: RoadEventsRealtimeClient,
  refresh: () => void
) {
  const channel = client
    .channel('road-events')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'road_events'
      },
      refresh
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
