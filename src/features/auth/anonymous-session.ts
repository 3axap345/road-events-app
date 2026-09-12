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

const pendingSessions = new WeakMap<AnonymousAuthGateway, Promise<AnonymousSession>>();

export function ensureAnonymousSession(auth: AnonymousAuthGateway): Promise<AnonymousSession> {
  const pending = pendingSessions.get(auth);
  if (pending) return pending;
  const request = establishSession(auth).finally(() => pendingSessions.delete(auth));
  pendingSessions.set(auth, request);
  return request;
}

async function establishSession(
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
