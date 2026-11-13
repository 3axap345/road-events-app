import {ReportPermissionError,ReportRateLimitError,type CreateEventDraft,type CreateEventResult} from '../events/create-event';
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
    let message: string;

    if (error instanceof ReportRateLimitError) {
      if (error.period === '10-minute') {
        message = 'Вы достигли лимита: 3 события за 10 минут. Попробуйте позже.';
      } else if (error.period === '24-hour') {
        message = 'Вы достигли лимита: 15 событий за 24 часа. Попробуйте позже.';
      } else {
        message = 'Вы достигли лимита публикаций. Попробуйте позже.';
      }
    } else if (error instanceof ReportPermissionError) {
      message = 'Отправка событий недоступна для этого аккаунта.';
    } else {
      message = 'Не удалось отправить событие. Проверьте соединение и повторите попытку.';
    }

    dispatch({ type: 'submission-failed', error: message });
  }
}
