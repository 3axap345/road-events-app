import { afterEach, expect, it, vi } from 'vitest';
import { getEventVotesGateway } from '../../../src/services/supabase/client';

const sdk = vi.hoisted(() => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn();
  eq.mockImplementation(() => ({ eq, maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return {
    from: vi.fn(() => ({ select })), select, eq, maybeSingle,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  };
});
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => sdk }));
afterEach(() => vi.unstubAllEnvs());

it('routes reads to own event vote and writes only to cast_event_vote', async () => {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-public-key');
  const gateway = getEventVotesGateway();
  await gateway.read('event', 'user');
  expect(sdk.from).toHaveBeenCalledExactlyOnceWith('event_votes');
  expect(sdk.select).toHaveBeenCalledExactlyOnceWith('event_id,user_id,vote_type');
  expect(sdk.eq.mock.calls).toEqual([['event_id', 'event'], ['user_id', 'user']]);
  expect(sdk.maybeSingle).toHaveBeenCalledOnce();
  await gateway.cast({ p_event_id: 'event', p_vote_type: 'confirm' });
  expect(sdk.rpc).toHaveBeenCalledExactlyOnceWith('cast_event_vote', { p_event_id: 'event', p_vote_type: 'confirm' });
});
