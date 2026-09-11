export interface AnonymousSession {
  accessToken: string;
}

interface AuthResult {
  data: { session: AnonymousSession | null };
  error: Error | null;
}

export interface AnonymousAuthGateway {
  getSession(): Promise<AuthResult>;
  signInAnonymously(): Promise<AuthResult>;
}

export async function ensureAnonymousSession(
  auth: AnonymousAuthGateway
): Promise<AnonymousSession> {
  const existing = await auth.getSession();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data.session) {
    return existing.data.session;
  }

  const created = await auth.signInAnonymously();

  if (created.error) {
    throw created.error;
  }

  if (!created.data.session) {
    throw new Error('Anonymous sign-in returned no session.');
  }

  return created.data.session;
}
