import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { ensureAnonymousSession } from '../features/auth/anonymous-session';
import { getAnonymousAuthGateway } from '../services/supabase/client';

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient()
  );

  useEffect(() => {
    void ensureAnonymousSession(
      getAnonymousAuthGateway()
    ).catch(() => {
      // Reporting retries authentication and presents failures in its confirmation UI.
      console.warn('Anonymous session bootstrap failed. Authentication will retry when reporting.');
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
