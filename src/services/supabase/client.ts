import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { AnonymousAuthGateway } from '../../features/auth/anonymous-session';
import type {
  RoadEventsReadClient,
  RoadEventsReadResult
} from '../../features/events/event-repository';
import { getSupabaseEnvironment } from './env';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const environment = getSupabaseEnvironment();
    supabaseClient = createClient(
      environment.EXPO_PUBLIC_SUPABASE_URL,
      environment.EXPO_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  return supabaseClient;
}

function toReadResult(result: {
  data: unknown;
  error: { message: string } | null;
}): RoadEventsReadResult {
  return {
    data: Array.isArray(result.data) ? result.data : null,
    error: result.error
  };
}

export function getRoadEventsReadClient(): RoadEventsReadClient {
  return {
    from: () => {
      const table = getSupabaseClient().from('road_events');

      return {
        select: (columns) => {
          const selected = table.select(columns);

          return {
            eq: (column, value) => {
              const filtered = selected.eq(column, value);

              return {
                gt: async (expiryColumn, expiryValue) =>
                  toReadResult(await filtered.gt(expiryColumn, expiryValue))
              };
            }
          };
        }
      };
    }
  };
}

function toAnonymousAuthResult(result: {
  data: { session: { access_token: string } | null };
  error: { message: string } | null;
}) {
  return {
    data: {
      session: result.data.session
        ? { accessToken: result.data.session.access_token }
        : null
    },
    error: result.error ? new Error(result.error.message) : null
  };
}

export function getAnonymousAuthGateway(): AnonymousAuthGateway {
  const auth = getSupabaseClient().auth;

  return {
    getSession: async () => toAnonymousAuthResult(await auth.getSession()),
    signInAnonymously: async () =>
      toAnonymousAuthResult(await auth.signInAnonymously())
  };
}
