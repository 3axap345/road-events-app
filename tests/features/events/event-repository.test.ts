import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  activeEventsQueryOptions,
  getActiveEvents,
  type RoadEventsReadClient
} from '../../../src/features/events/event-repository';

const activeEventRow = {
  id: 'event-1',
  reporter_id: 'user-1',
  event_type: 'road_hazard',
  latitude: 42.8746,
  longitude: 74.5698,
  status: 'active',
  confidence: 0,
  confirmation_count: 2,
  gone_count: 0,
  created_at: '2026-09-11T11:55:00.000Z',
  last_confirmed_at: null,
  expires_at: '2026-09-11T16:00:00.000Z'
};

function createReadClient(
  result: { data: unknown[] | null; error: Error | null }
): RoadEventsReadClient & {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
} {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn();
  const from = vi.fn();

  select.mockReturnValue({ eq });
  from.mockReturnValue({ select });

  return { from, select, eq };
}

describe('getActiveEvents', () => {
  it('reads only active, non-expired events and maps rows through the domain parser', async () => {
    const client = createReadClient({ data: [activeEventRow], error: null });

    const events = await getActiveEvents(client);

    expect(client.from).toHaveBeenCalledWith('road_events');
    expect(client.select).toHaveBeenCalledWith('*');
    expect(client.eq).toHaveBeenCalledWith('status', 'active');
    expect(events).toEqual([
      expect.objectContaining({
        id: 'event-1',
        eventType: 'road_hazard',
        confirmationCount: 2
      })
    ]);
  });

  it('propagates a read error into TanStack Query state', async () => {
    const client = createReadClient({
      data: null,
      error: new Error('Network unavailable')
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const options = activeEventsQueryOptions(client);

    await expect(queryClient.fetchQuery(options)).rejects.toThrow('Network unavailable');
    expect(queryClient.getQueryState(options.queryKey)?.status).toBe('error');
  });
});
