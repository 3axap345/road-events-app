import { describe, expect, it, vi } from 'vitest';

import { bindRoadEventsRealtime } from '../../../src/features/events/road-events-realtime';

describe('road events realtime', () => {
  it('subscribes to road_events changes, refreshes, and removes the channel on cleanup', () => {
    let onChange = () => {};
    const subscribe = vi.fn();
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
      subscribe: vi.fn(() => {
        subscribe();
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
    expect(subscribe).toHaveBeenCalledOnce();

    onChange();
    expect(refresh).toHaveBeenCalledOnce();

    stop();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
