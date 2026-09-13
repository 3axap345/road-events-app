import { afterEach, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '../../../src/services/supabase/client';

// Native storage and SDK construction are external boundaries, not Node runtimes.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));

afterEach(() => vi.unstubAllEnvs());

it('constructs one client with explicit persistent native auth storage and refresh options', () => {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-public-key');
  const client = getSupabaseClient();
  expect(createClient).toHaveBeenCalledExactlyOnceWith(
    'https://example.supabase.co',
    'test-public-key',
    { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
  );
  expect(getSupabaseClient()).toBe(client);
  expect(createClient).toHaveBeenCalledOnce();
});
