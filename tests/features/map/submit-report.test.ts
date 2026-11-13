import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReportPermissionError, ReportRateLimitError, type CreateEventDraft, type CreateEventResult } from '../../../src/features/events/create-event';
import { submitReport } from '../../../src/features/map/submit-report';
import type { ReportLocationAction, ReportLocationState } from '../../../src/features/map/report-location';
import { useMapSelectionStore } from '../../../src/stores/map-selection-store';

const draft = { coordinate: { latitude: 42.87, longitude: 74.59 }, eventType: 'accident' as const };
const idle: ReportLocationState = { kind: 'idle', coordinate: null, eventType: null };
const networkMessage = 'Не удалось отправить событие. Проверьте соединение и повторите попытку.';
const getState = () => useMapSelectionStore.getState().reportLocation;
const dispatch = (action: ReportLocationAction) =>
  useMapSelectionStore.getState().dispatchReportLocation(action);

afterEach(() => useMapSelectionStore.setState({ reportLocation: idle }));

describe('submitReport', () => {
  it.each([
    { error: new TypeError('Network request failed'), message: networkMessage },
    { error: 'unexpected rejection', message: networkMessage },
    { error: new ReportPermissionError('internal details'), message: 'Отправка событий недоступна для этого аккаунта.' },
    { error: new ReportRateLimitError('10-minute'), message: 'Вы достигли лимита: 3 события за 10 минут. Попробуйте позже.' },
    { error: new ReportRateLimitError('24-hour'), message: 'Вы достигли лимита: 15 событий за 24 часа. Попробуйте позже.' },
    { error: new ReportRateLimitError('unknown'), message: 'Вы достигли лимита публикаций. Попробуйте позже.' }
  ])('restores the draft with a safe message: $message', async ({ error, message }) => {
    useMapSelectionStore.setState({ reportLocation: { kind: 'ready', ...draft } });
    const mutate = vi.fn<(input: CreateEventDraft) => Promise<CreateEventResult>>().mockRejectedValue(error);

    await expect(submitReport(getState, dispatch, mutate)).resolves.toBeUndefined();

    expect(getState()).toEqual({ kind: 'ready', ...draft, error: message });
    expect(mutate).toHaveBeenCalledExactlyOnceWith(draft);
  });

  it('blocks overlapping submissions and permits one explicit retry after failure', async () => {
    useMapSelectionStore.setState({ reportLocation: { kind: 'ready', ...draft } });
    let reject!: (error: Error) => void;
    let resolve!: (result: CreateEventResult) => void;
    const first = new Promise<CreateEventResult>((_, fail) => { reject = fail; });
    const second = new Promise<CreateEventResult>((done) => { resolve = done; });
    const mutate = vi.fn<(input: CreateEventDraft) => Promise<CreateEventResult>>()
      .mockReturnValueOnce(first).mockReturnValueOnce(second);

    const pending = submitReport(getState, dispatch, mutate);
    expect(getState()).toEqual({ kind: 'submitting', ...draft });
    await submitReport(getState, dispatch, mutate);
    expect(mutate).toHaveBeenCalledOnce();
    reject(new TypeError('Network request failed'));
    await pending;
    expect(getState()).toEqual({ kind: 'ready', ...draft, error: networkMessage });
    expect(mutate).toHaveBeenCalledOnce();

    const retry = submitReport(getState, dispatch, mutate);
    expect(getState()).toEqual({ kind: 'submitting', ...draft });
    await submitReport(getState, dispatch, mutate);
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate).toHaveBeenLastCalledWith(draft);
    resolve({ kind: 'created' });
    await retry;
    expect(getState()).toEqual(idle);
  });

  it.each<ReportLocationState>([
    idle,
    { kind: 'choosing-type', ...draft },
    { kind: 'submitting', ...draft },
    { kind: 'duplicate', ...draft, existingEventId: 'existing' },
    { kind: 'viewing-duplicate', ...draft, existingEventId: 'existing' }
  ])('does not submit from $kind', async (state) => {
    useMapSelectionStore.setState({ reportLocation: state });
    const mutate = vi.fn<(input: CreateEventDraft) => Promise<CreateEventResult>>();
    await submitReport(getState, dispatch, mutate);
    expect(mutate).not.toHaveBeenCalled();
    expect(getState()).toEqual(state);
  });
});
