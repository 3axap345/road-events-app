import { ensureAnonymousSession, type AnonymousAuthGateway } from './anonymous-session';

export interface AuthenticatedUserGateway extends AnonymousAuthGateway {
  getUser(): Promise<{ userId: string | null; error: Error | null }>;
}

export async function requireAuthenticatedUserId(auth: AuthenticatedUserGateway): Promise<string> {
  await ensureAnonymousSession(auth);
  const result = await auth.getUser();
  if (result.error) throw result.error;
  if (!result.userId) throw new Error('Не удалось подтвердить пользователя. Повторите отправку.');
  return result.userId;
}
