import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { ensureAnonymousSession } from '../features/auth/anonymous-session';
import { bindAuthRefreshLifecycle, logDevelopmentUserId } from '../services/supabase/auth-runtime';
import { getAnonymousAuthGateway, getSupabaseClient } from '../services/supabase/client';

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient()
  );

  useEffect(() => {
    const cleanup = Platform.OS !== 'web'
      ? bindAuthRefreshLifecycle(AppState, getSupabaseClient().auth)
      : undefined;
    void ensureAnonymousSession(
      getAnonymousAuthGateway()
    ).then(() => {
      if (__DEV__) void logDevelopmentUserId(getAnonymousAuthGateway());
    }).catch(() => {
      // Reporting retries authentication and presents failures in its confirmation UI.
      console.warn('Anonymous session bootstrap failed. Authentication will retry when reporting.');
    });
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
