import { describe, expect, it, vi } from 'vitest';

import { createVoteController } from '../../../src/features/voting/vote-controller';

describe('vote submission controller', () => {
  it('treats the same selected vote as a no-op', async () => {
    const cast = vi.fn();
    const refresh = vi.fn();
    const controller = createVoteController({ cast, refresh, onChange: vi.fn() });
    await controller.submit('confirm', 'confirm');
    await controller.submit('gone', 'gone');
    expect(cast).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'confirm'], [null, 'gone'], ['confirm', 'gone'], ['gone', 'confirm']
  ] as const)('submits %s -> %s and waits for reads before becoming idle', async (selected, next) => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const cast = vi.fn().mockResolvedValue(undefined);
    const controller = createVoteController({ cast, refresh, onChange: vi.fn() });
    const request = controller.submit(next, selected);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(controller.getState().kind).toBe('refreshing');
    await controller.submit(next, selected);
    expect(cast).toHaveBeenCalledExactlyOnceWith(next);
    finish(); await request;
    expect(controller.getState().kind).toBe('idle');
  });

  it('prevents duplicate taps synchronously before the RPC resolves', async () => {
    let finish!: () => void;
    const cast = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const controller = createVoteController({ cast, refresh: async () => {}, onChange: vi.fn() });
    const request = controller.submit('confirm', null);
    expect(controller.getState().kind).toBe('submitting');
    await controller.submit('gone', null);
    expect(cast).toHaveBeenCalledOnce();
    finish(); await request;
  });

  it('permits explicit retry after a failed write without refreshing counters', async () => {
    const cast = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const controller = createVoteController({ cast, refresh, onChange: vi.fn() });
    await controller.submit('gone', 'confirm');
    expect(controller.getState()).toMatchObject({ kind: 'submit-error', voteType: 'gone' });
    expect(refresh).not.toHaveBeenCalled();
    await controller.submit('gone', 'confirm');
    expect(controller.getState().kind).toBe('idle');
    expect(cast).toHaveBeenCalledTimes(2);
  });

  it('retries reads ONLY after a saved vote whose refresh failed', async () => {
    const cast = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const controller = createVoteController({ cast, refresh, onChange: vi.fn() });
    await controller.submit('confirm', null);
    expect(controller.getState().kind).toBe('refresh-error');
    await controller.submit('confirm', null);
    expect(cast).toHaveBeenCalledOnce();
    await controller.retryRefresh();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(controller.getState().kind).toBe('idle');
    expect(cast).toHaveBeenCalledOnce();
  });

  it('allows refresh-only recovery from a newly mounted controller without recasting', async () => {
    const cast = vi.fn();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const controller = createVoteController({ cast, refresh, onChange: vi.fn() });
    await controller.retryRefresh();
    expect(refresh).toHaveBeenCalledOnce();
    expect(cast).not.toHaveBeenCalled();
  });
});
