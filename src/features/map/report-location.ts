import type { RoadEventType } from '../events/types';
import type { MapCoordinate, MapProviderProps } from './map-types';

export type ReportLocationState =
  | { kind: 'idle'; coordinate: null; eventType: null }
  | { kind: 'choosing-type'; coordinate: MapCoordinate; eventType: RoadEventType | null }
  | { kind: 'ready'; coordinate: MapCoordinate; eventType: RoadEventType; error?: string }
  | { kind: 'submitting'; coordinate: MapCoordinate; eventType: RoadEventType }
  | { kind: 'duplicate' | 'viewing-duplicate'; coordinate: MapCoordinate; eventType: RoadEventType; existingEventId: string; error?: string };

export type ReportLocationAction =
  | { type: 'cancel' | 'continue' | 'back' | 'submit' | 'submitted' }
  | { type: 'submission-failed'; error: string }
  | { type: 'duplicate-found'; existingEventId: string }
  | { type: 'view-duplicate' | 'duplicate-opened' | 'duplicate-unavailable' }
  | { type: 'duplicate-view-failed'; error: string }
  | { type: 'select-type'; eventType: RoadEventType }
  | { type: 'long-press'; coordinate: MapCoordinate };

export function buildReportMapInteractions(
  state: ReportLocationState,
  dispatch: (action: ReportLocationAction) => void,
  onMarkerPress: (id: string) => void
): Pick<MapProviderProps, 'onMapLongPress' | 'onMarkerPress'> {
  return {
    onMarkerPress,
    onMapLongPress: state.kind === 'idle' || state.kind === 'choosing-type'
      ? (coordinate) => dispatch({ type: 'long-press', coordinate })
      : undefined
  };
}

export function reduceReportLocation(
  state: ReportLocationState,
  action: ReportLocationAction
): ReportLocationState {
  if (state.kind === 'submitting') {
    if (action.type === 'duplicate-found') return { ...state, kind: 'duplicate', existingEventId: action.existingEventId };
    if (action.type === 'submitted') return { kind: 'idle', coordinate: null, eventType: null };
    if (action.type === 'submission-failed') return { ...state, kind: 'ready', error: action.error };
    return state;
  }
  if (state.kind === 'duplicate' || state.kind === 'viewing-duplicate') {
    const draft = { coordinate: state.coordinate, eventType: state.eventType };
    if (action.type === 'cancel' || action.type === 'duplicate-opened') return { kind: 'idle', coordinate: null, eventType: null };
    if (action.type === 'back') return { kind: 'choosing-type', ...draft };
    if (action.type === 'view-duplicate' && state.kind === 'duplicate') return { ...state, kind: 'viewing-duplicate', error: undefined };
    if (state.kind === 'viewing-duplicate' && action.type === 'duplicate-unavailable') return {
      kind: 'ready', ...draft, error: 'Это событие больше не доступно. При необходимости отправьте свою отметку снова.'
    };
    if (state.kind === 'viewing-duplicate' && action.type === 'duplicate-view-failed') return { ...state, kind: 'duplicate', error: action.error };
    return state;
  }
  switch (action.type) {
    case 'submit':
      return state.kind === 'ready'
        ? { kind: 'submitting', coordinate: state.coordinate, eventType: state.eventType }
        : state;
    case 'submitted':
    case 'submission-failed':
    case 'duplicate-found':
    case 'view-duplicate':
    case 'duplicate-opened':
    case 'duplicate-unavailable':
    case 'duplicate-view-failed':
      return state;
    case 'cancel':
      return { kind: 'idle', coordinate: null, eventType: null };
    case 'long-press':
      return state.kind === 'idle' || state.kind === 'choosing-type'
        ? { kind: 'choosing-type', coordinate: action.coordinate, eventType: state.eventType }
        : state;
    case 'select-type':
      return state.kind === 'choosing-type'
        ? { ...state, eventType: action.eventType }
        : state;
    case 'back':
      if (state.kind === 'choosing-type') return { kind: 'idle', coordinate: null, eventType: null };
      if (state.kind === 'ready') return { ...state, kind: 'choosing-type' };
      return state;
    case 'continue':
      if (state.kind === 'choosing-type' && state.eventType) {
        return { kind: 'ready', coordinate: state.coordinate, eventType: state.eventType };
      }
      return state;
  }
}
