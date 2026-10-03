import { describe, expect, it, vi } from 'vitest';

import { bindRoadEventsRealtime } from '../../../src/features/events/road-events-realtime';

describe('road events realtime', () => {
  it('subscribes to road_events changes, refreshes on changes and subscribe, and cleans up', () => {
    let onChange = () => {};
    let onStatus = (_status: string) => {};
    const removeChannel = vi.fn();

    const channel = {
      on: vi.fn((_type, filter, callback) => {
        expect(filter).toEqual({
          event: '*',
          schema: 'public',
          table: 'road_events'
        });
        onChange = callback;
        return channel;
      }),
      subscribe: vi.fn((callback) => {
        onStatus = callback;
        return channel;
      })
    };

    const client = {
      channel: vi.fn(() => channel),
      removeChannel
    };

    const refresh = vi.fn();
    const stop = bindRoadEventsRealtime(client, refresh);

    expect(client.channel).toHaveBeenCalledWith('road-events');

    onStatus('SUBSCRIBED');
    expect(refresh).toHaveBeenCalledTimes(1);

    onChange();
    expect(refresh).toHaveBeenCalledTimes(2);

    onStatus('CHANNEL_ERROR');
    onStatus('TIMED_OUT');
    onStatus('CLOSED');
    expect(refresh).toHaveBeenCalledTimes(2);

    onStatus('SUBSCRIBED');
    expect(refresh).toHaveBeenCalledTimes(3);

    stop();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
