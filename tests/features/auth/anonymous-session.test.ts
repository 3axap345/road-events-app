import { describe, expect, it, vi } from 'vitest';

import {
  ensureAnonymousSession,
  type AnonymousAuthGateway,
  type AnonymousSession
} from '../../../src/features/auth/anonymous-session';

const existingSession: AnonymousSession = {
  accessToken: 'existing-access-token'
};

function createGateway(
  session: AnonymousSession | null
): AnonymousAuthGateway & {
  getSession: ReturnType<typeof vi.fn>;
  signInAnonymously: ReturnType<typeof vi.fn>;
} {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signInAnonymously: vi
      .fn()
      .mockResolvedValue({ data: { session: existingSession }, error: null })
  };
}

describe('ensureAnonymousSession', () => {
  it('returns an existing session without creating another anonymous user', async () => {
    const auth = createGateway(existingSession);

    await expect(ensureAnonymousSession(auth)).resolves.toEqual(existingSession);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('creates an anonymous session when no existing session is restored', async () => {
    const auth = createGateway(null);

    await expect(ensureAnonymousSession(auth)).resolves.toEqual(existingSession);
    expect(auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('propagates an anonymous sign-in error', async () => {
    const auth = createGateway(null);
    const failure = new Error('Anonymous sign-in failed');
    auth.signInAnonymously.mockResolvedValue({
      data: { session: null },
      error: failure
    });

    await expect(ensureAnonymousSession(auth)).rejects.toThrow(failure);
  });
});
