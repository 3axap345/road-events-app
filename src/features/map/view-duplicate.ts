import type { RoadEvent } from '../events/types';
import type { ReportLocationAction, ReportLocationState } from './report-location';

export async function viewDuplicate(
  getState: () => ReportLocationState,
  dispatch: (action: ReportLocationAction) => void,
  load: (id: string) => Promise<RoadEvent | null>,
  open: (event: RoadEvent) => void
): Promise<void> {
  const state = getState();
  if (state.kind !== 'duplicate') return;
  dispatch({ type: 'view-duplicate' });
  const pending = getState();
  try {
    const event = await load(state.existingEventId);
    // Ignore results from a cancelled/replaced draft, including cancel + reopen.
    if (getState() !== pending) return;
    if (!event) {
      dispatch({ type: 'duplicate-unavailable' });
      return;
    }
    open(event);
    dispatch({ type: 'duplicate-opened' });
  } catch {
    if (getState() !== pending) return;
    dispatch({ type: 'duplicate-view-failed', error: 'Не удалось загрузить событие. Проверьте соединение и попробуйте открыть его снова.' });
  }
}
