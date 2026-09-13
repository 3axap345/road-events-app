import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppState, AppStateStatus } from 'react-native';

import type { AuthenticatedUserGateway } from '../../features/auth/authenticated-user';

export function bindAuthRefreshLifecycle(
  appState: Pick<typeof AppState, 'currentState' | 'addEventListener'>,
  auth: Pick<SupabaseClient['auth'], 'startAutoRefresh' | 'stopAutoRefresh'>
): () => void {
  const update = (state: AppStateStatus | null) => {
    if (state === 'active') {
      void auth.startAutoRefresh();
    } else {
      void auth.stopAutoRefresh();
    }
  };
  const subscription = appState.addEventListener('change', update);
  update(appState.currentState);

  return () => {
    subscription.remove();
    void auth.stopAutoRefresh();
  };
}

// Temporary cold-start diagnostic: remove this helper and its root-layout call
// after device verification. Never log the session or an auth error object.
export async function logDevelopmentUserId(
  auth: Pick<AuthenticatedUserGateway, 'getUser'>
): Promise<void> {
  if (!__DEV__) return;
  try {
    const { userId, error } = await auth.getUser();
    if (!error && userId) console.info('[auth-check] userId:', userId);
  } catch {
    // Diagnostics must not affect authentication or reporting on network failure.
  }
}
