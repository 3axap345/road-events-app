import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { requireAuthenticatedUserId, type AuthenticatedUserGateway } from '../../features/auth/authenticated-user';
import type { RoadEventsWriteGateway } from '../../features/events/create-event';
import type {
  RoadEventsReadClient,
  RoadEventsReadResult
} from '../../features/events/event-repository';
import { getSupabaseEnvironment } from './env';

let supabaseClient: SupabaseClient | null = null;
let anonymousAuthGateway: AuthenticatedUserGateway | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const environment = getSupabaseEnvironment();
    supabaseClient = createClient(
      environment.EXPO_PUBLIC_SUPABASE_URL,
      environment.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      }
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

export function getAnonymousAuthGateway(): AuthenticatedUserGateway {
  if (anonymousAuthGateway) return anonymousAuthGateway;
  const auth = getSupabaseClient().auth;

  anonymousAuthGateway = {
    getUser: async () => {
      const { data, error } = await auth.getUser();
      return { userId: data.user?.id ?? null, error: error ? new Error(error.message) : null };
    },
    getSession: async () => toAnonymousAuthResult(await auth.getSession()),
    signInAnonymously: async () =>
      toAnonymousAuthResult(await auth.signInAnonymously())
  };
  return anonymousAuthGateway;
}

export function getRoadEventsWriteGateway(): RoadEventsWriteGateway {
  return {
    getUserId: () => requireAuthenticatedUserId(getAnonymousAuthGateway()),
    insert: async (payload) => {
      const { error } = await getSupabaseClient().from('road_events').insert(payload);
      return { error };
    }
  };
}
