import type { CreateEventDraft } from '../events/create-event';
import type { ReportLocationAction, ReportLocationState } from './report-location';

export async function submitReport(
  getState: () => ReportLocationState,
  dispatch: (action: ReportLocationAction) => void,
  mutate: (draft: CreateEventDraft) => Promise<unknown>
): Promise<void> {
  const state = getState();
  if (state.kind !== 'ready') return;
  // Synchronous state transition closes the double-tap window before any await.
  dispatch({ type: 'submit' });
  try {
    await mutate({ coordinate: state.coordinate, eventType: state.eventType });
    dispatch({ type: 'submitted' });
  } catch {
    dispatch({ type: 'submission-failed', error: 'Не удалось отправить событие. Проверьте соединение и повторите попытку.' });
  }
}
