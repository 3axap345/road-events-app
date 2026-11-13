import { describe, expect, it, vi } from 'vitest';

import { bindEventVoteRealtime } from '../../../src/features/voting/event-votes-realtime';

describe('event vote realtime', () => {
  it('subscribes to the selected event vote, refreshes on changes and reconnect, and cleans up', () => {
    const eventId = '11111111-1111-4111-8111-111111111111';
    let onChange = () => {};
    let onStatus = (_status: string) => {};
    const removeChannel = vi.fn();

    const channel = {
      on: vi.fn((_type, filter, callback) => {
        expect(filter).toEqual({
          event: '*',
          schema: 'public',
          table: 'event_votes',
          filter: `event_id=eq.${eventId}`
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
    const stop = bindEventVoteRealtime(client, eventId, refresh);

    expect(client.channel).toHaveBeenCalledWith(`event-vote-${eventId}`);

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
