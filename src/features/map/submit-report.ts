import { ReportPermissionError, type CreateEventDraft, type CreateEventResult } from '../events/create-event';
import type { ReportLocationAction, ReportLocationState } from './report-location';

export async function submitReport(
  getState: () => ReportLocationState,
  dispatch: (action: ReportLocationAction) => void,
  mutate: (draft: CreateEventDraft) => Promise<CreateEventResult>
): Promise<void> {
  const state = getState();
  if (state.kind !== 'ready') return;
  // Synchronous state transition closes the double-tap window before any await.
  dispatch({ type: 'submit' });
  try {
    const result = await mutate({ coordinate: state.coordinate, eventType: state.eventType });
    dispatch(result.kind === 'duplicate'
      ? { type: 'duplicate-found', existingEventId: result.existingEventId }
      : { type: 'submitted' });
  } catch (error) {
    dispatch({ type: 'submission-failed', error: error instanceof ReportPermissionError
      ? 'Отправка событий недоступна для этого аккаунта.'
      : 'Не удалось отправить событие. Проверьте соединение и повторите попытку.' });
  }
}
