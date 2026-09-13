import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStateStatus } from 'react-native';

import { bindAuthRefreshLifecycle, logDevelopmentUserId } from '../../../src/services/supabase/auth-runtime';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth refresh lifecycle', () => {
  function setup(currentState: AppStateStatus) {
    let listener: ((state: AppStateStatus) => void) | undefined;
    const remove = vi.fn(() => { listener = undefined; });
    const appState = {
      currentState,
      addEventListener: vi.fn((_event: 'change', callback: (state: AppStateStatus) => void) => {
        listener = callback;
        return { remove };
      })
    };
    const auth = { startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn() };
    return { auth, appState, remove, change: (state: AppStateStatus) => listener?.(state) };
  }

  it('starts for the current active state and follows foreground/background changes', () => {
    const runtime = setup('active');
    const cleanup = bindAuthRefreshLifecycle(runtime.appState, runtime.auth);
    expect(runtime.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    runtime.change('background');
    expect(runtime.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    runtime.change('inactive');
    expect(runtime.auth.stopAutoRefresh).toHaveBeenCalledTimes(2);
    runtime.change('active');
    expect(runtime.auth.startAutoRefresh).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('stops immediately when initially backgrounded and removes the listener on cleanup', () => {
    const runtime = setup('background');
    const cleanup = bindAuthRefreshLifecycle(runtime.appState, runtime.auth);
    expect(runtime.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(runtime.appState.addEventListener).toHaveBeenCalledTimes(1);
    cleanup();
    expect(runtime.remove).toHaveBeenCalledOnce();
    expect(runtime.auth.stopAutoRefresh).toHaveBeenCalledTimes(2);
    runtime.change('active');
    expect(runtime.auth.startAutoRefresh).not.toHaveBeenCalled();
  });
});

describe('development UUID diagnostic', () => {
  it('logs only the user UUID in development', async () => {
    vi.stubGlobal('__DEV__', true);
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const userId = 'f572bead-5d10-4df0-9f51-47f191beed6f';
    await logDevelopmentUserId({ getUser: async () => ({ userId, error: null }) });
    expect(log).toHaveBeenCalledExactlyOnceWith('[auth-check] userId:', userId);
  });

  it('does not fetch or log in production', async () => {
    vi.stubGlobal('__DEV__', false);
    const getUser = vi.fn();
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await logDevelopmentUserId({ getUser });
    expect(getUser).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('does not log missing users or auth errors and never fails startup', async () => {
    vi.stubGlobal('__DEV__', true);
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await logDevelopmentUserId({ getUser: async () => ({ userId: null, error: null }) });
    await logDevelopmentUserId({ getUser: async () => ({ userId: null, error: new Error('offline') }) });
    await expect(logDevelopmentUserId({ getUser: async () => { throw new Error('offline'); } })).resolves.toBeUndefined();
    expect(log).not.toHaveBeenCalled();
  });
});
