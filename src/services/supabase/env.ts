import { z } from 'zod';

const supabaseEnvironmentSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

export type SupabaseEnvironment = z.infer<typeof supabaseEnvironmentSchema>;

export function getSupabaseEnvironment(): SupabaseEnvironment {
  return supabaseEnvironmentSchema.parse({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  });
}
