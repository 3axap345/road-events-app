import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindActiveEventsRefresh } from '../../../src/features/events/active-events-refresh';

afterEach(() => vi.useRealTimers());

describe('foreground event refresh', () => {
  it('polls every minute only while active, refreshes on resume, and cleans up', () => {
    vi.useFakeTimers();
    let change = (_state: string) => {};
    const remove = vi.fn();
    const refresh = vi.fn();
    const stop = bindActiveEventsRefresh({
      currentState: 'active',
      addEventListener: (_event, listener) => { change = listener; return { remove }; }
    }, refresh);
    vi.advanceTimersByTime(59_999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    change('background');
    vi.advanceTimersByTime(180_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    change('active');
    expect(refresh).toHaveBeenCalledTimes(2);
    change('active');
    expect(refresh).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(120_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledOnce();
  });

  it('does not poll when initially backgrounded', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const stop = bindActiveEventsRefresh({
      currentState: 'background',
      addEventListener: () => ({ remove: () => {} })
    }, refresh);
    vi.advanceTimersByTime(180_000);
    expect(refresh).not.toHaveBeenCalled();
    stop();
  });
});
