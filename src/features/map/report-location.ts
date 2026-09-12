import type { RoadEventType } from '../events/types';
import type { MapCoordinate } from './map-types';

export type ReportLocationState =
  | { kind: 'idle'; coordinate: null; eventType: null }
  | { kind: 'selecting'; coordinate: MapCoordinate | null; eventType: RoadEventType | null }
  | { kind: 'choosing-type'; coordinate: MapCoordinate; eventType: RoadEventType | null }
  | { kind: 'ready'; coordinate: MapCoordinate; eventType: RoadEventType; error?: string }
  | { kind: 'submitting'; coordinate: MapCoordinate; eventType: RoadEventType };

export type ReportLocationAction =
  | { type: 'start' | 'cancel' | 'continue' | 'back' | 'submit' | 'submitted' }
  | { type: 'submission-failed'; error: string }
  | { type: 'select-type'; eventType: RoadEventType }
  | { type: 'select'; coordinate: MapCoordinate };

export function reduceReportLocation(
  state: ReportLocationState,
  action: ReportLocationAction
): ReportLocationState {
  if (state.kind === 'submitting') {
    if (action.type === 'submitted') return { kind: 'idle', coordinate: null, eventType: null };
    if (action.type === 'submission-failed') return { ...state, kind: 'ready', error: action.error };
    return state;
  }
  switch (action.type) {
    case 'submit':
      return state.kind === 'ready'
        ? { kind: 'submitting', coordinate: state.coordinate, eventType: state.eventType }
        : state;
    case 'submitted':
    case 'submission-failed':
      return state;
    case 'start':
      return { kind: 'selecting', coordinate: null, eventType: null };
    case 'cancel':
      return { kind: 'idle', coordinate: null, eventType: null };
    case 'select':
      return state.kind === 'selecting'
        ? { ...state, coordinate: action.coordinate }
        : state;
    case 'select-type':
      return state.kind === 'choosing-type'
        ? { ...state, eventType: action.eventType }
        : state;
    case 'back':
      if (state.kind === 'choosing-type') return { ...state, kind: 'selecting' };
      if (state.kind === 'ready') return { ...state, kind: 'choosing-type' };
      return state;
    case 'continue':
      if (state.kind === 'selecting' && state.coordinate) {
        return { kind: 'choosing-type', coordinate: state.coordinate, eventType: state.eventType };
      }
      if (state.kind === 'choosing-type' && state.eventType) {
        return { kind: 'ready', coordinate: state.coordinate, eventType: state.eventType };
      }
      return state;
  }
}
