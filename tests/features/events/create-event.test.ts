import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { createRoadEvent, createEventMutationOptions, type CreateEventDraft } from '../../../src/features/events/create-event';
import { ACTIVE_EVENTS_QUERY_KEY } from '../../../src/features/events/event-repository';
import { requireAuthenticatedUserId } from '../../../src/features/auth/authenticated-user';
import { ensureAnonymousSession } from '../../../src/features/auth/anonymous-session';
import { submitReport } from '../../../src/features/map/submit-report';
import { reduceReportLocation, type ReportLocationState } from '../../../src/features/map/report-location';

const userId = '11111111-1111-4111-8111-111111111111';
const draft = { coordinate: { latitude: 42.87, longitude: 74.59 }, eventType: 'accident' as const };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function flow() {
  let state: ReportLocationState = { kind: 'ready', ...draft };
  return { getState: () => state, dispatch: (action: Parameters<typeof reduceReportLocation>[1]) => { state = reduceReportLocation(state, action); } };
}

describe('road event submission', () => {
  it('uses the authenticated user and sends exactly the allowed columns', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    await createRoadEvent({ getUserId: async () => userId, insert }, draft);
    expect(insert).toHaveBeenCalledExactlyOnceWith({ reporter_id: userId, event_type: 'accident', latitude: 42.87, longitude: 74.59 });
  });

  it('does not insert with invalid coordinates or a missing user', async () => {
    const insert = vi.fn();
    await expect(createRoadEvent({ getUserId: async () => userId, insert }, { ...draft, coordinate: { latitude: 91, longitude: 0 } })).rejects.toThrow();
    await expect(createRoadEvent({ getUserId: async () => '', insert }, draft)).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it('waits for shared startup auth and rejects a missing authenticated user', async () => {
    const session = deferred<{ data: { session: { accessToken: string } }; error: null }>();
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn(() => session.promise),
      getUser: vi.fn().mockResolvedValue({ userId, error: null })
    };
    const startup = ensureAnonymousSession(auth);
    const submitting = requireAuthenticatedUserId(auth);
    await vi.waitFor(() => expect(auth.signInAnonymously).toHaveBeenCalledOnce());
    expect(auth.getUser).not.toHaveBeenCalled();
    session.resolve({ data: { session: { accessToken: 'test-token' } }, error: null });
    await startup;
    expect(await submitting).toBe(userId);
    auth.getUser.mockResolvedValueOnce({ userId: null, error: null });
    await expect(requireAuthenticatedUserId(auth)).rejects.toThrow();
  });

  it('keeps the draft pending through successful mutation and active query refresh', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(ACTIVE_EVENTS_QUERY_KEY, []);
    const refreshed = deferred<string[]>();
    const queryFn = vi.fn(() => refreshed.promise);
    const observer = new QueryObserver(client, { queryKey: ACTIVE_EVENTS_QUERY_KEY, queryFn, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    const insert = vi.fn().mockResolvedValue({ error: null });
    const mutation = client.getMutationCache().build(client, createEventMutationOptions(client, { getUserId: async () => userId, insert }));
    const state = flow();
    const run = submitReport(state.getState, state.dispatch, (input) => mutation.execute(input));
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledOnce());
    expect(state.getState()).toMatchObject({ kind: 'submitting', ...draft });
    await submitReport(state.getState, state.dispatch, (input) => mutation.execute(input));
    expect(insert).toHaveBeenCalledOnce();
    refreshed.resolve(['server-event']);
    await run;
    expect(mutation.state.status).toBe('success');
    expect(client.getQueryData(ACTIVE_EVENTS_QUERY_KEY)).toEqual(['server-event']);
    expect(state.getState()).toEqual({ kind: 'idle', coordinate: null, eventType: null });
    unsubscribe();
    client.clear();
  });

  it('preserves the draft on insert failure and permits an explicit retry', async () => {
    const client = new QueryClient();
    const insert = vi.fn().mockResolvedValueOnce({ error: { message: 'denied' } }).mockResolvedValueOnce({ error: null });
    const options = createEventMutationOptions(client, { getUserId: async () => userId, insert });
    const state = flow();
    const execute = (input: CreateEventDraft) => client.getMutationCache().build(client, options).execute(input);
    await submitReport(state.getState, state.dispatch, execute);
    expect(state.getState()).toMatchObject({ kind: 'ready', ...draft, error: expect.any(String) });
    expect(insert).toHaveBeenCalledOnce();
    await submitReport(state.getState, state.dispatch, execute);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(state.getState().kind).toBe('idle');
    client.clear();
  });

  it('preserves a draft when auth fails and retries auth on the next attempt', async () => {
    const client = new QueryClient();
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn()
        .mockResolvedValueOnce({ data: { session: null }, error: new Error('auth unavailable') })
        .mockResolvedValueOnce({ data: { session: { accessToken: 'test-token' } }, error: null }),
      getUser: vi.fn().mockResolvedValue({ userId, error: null })
    };
    const insert = vi.fn().mockResolvedValue({ error: null });
    const options = createEventMutationOptions(client, { getUserId: () => requireAuthenticatedUserId(auth), insert });
    const state = flow();
    const execute = (input: CreateEventDraft) => client.getMutationCache().build(client, options).execute(input);
    await submitReport(state.getState, state.dispatch, execute);
    expect(state.getState()).toMatchObject({ kind: 'ready', ...draft });
    expect(insert).not.toHaveBeenCalled();
    await submitReport(state.getState, state.dispatch, execute);
    expect(state.getState().kind).toBe('idle');
    expect(insert).toHaveBeenCalledOnce();
    client.clear();
  });

  it('does not repeat a saved insert when the subsequent map refresh fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(ACTIVE_EVENTS_QUERY_KEY, []);
    const observer = new QueryObserver(client, {
      queryKey: ACTIVE_EVENTS_QUERY_KEY, staleTime: Infinity,
      queryFn: async () => { throw new Error('read unavailable'); }
    });
    const unsubscribe = observer.subscribe(() => {});
    const insert = vi.fn().mockResolvedValue({ error: null });
    const mutation = client.getMutationCache().build(client, createEventMutationOptions(client, { getUserId: async () => userId, insert }));
    const state = flow();
    await submitReport(state.getState, state.dispatch, (input) => mutation.execute(input));
    expect(state.getState().kind).toBe('idle');
    expect(client.getQueryState(ACTIVE_EVENTS_QUERY_KEY)?.status).toBe('error');
    expect(insert).toHaveBeenCalledOnce();
    unsubscribe();
    client.clear();
  });
});
