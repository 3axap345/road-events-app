import type { RoadEventType } from '../events/types';

export interface EventMarkerVisual {
  icon: 'shield' | 'collision' | 'warning' | 'no-entry' | 'generic';
  backgroundColor: string;
  foregroundColor: string;
}

const EVENT_MARKER_VISUALS: Record<RoadEventType, EventMarkerVisual> = {
  road_check: { icon: 'shield', backgroundColor: '#1E40AF', foregroundColor: '#FFFFFF' },
  accident: { icon: 'collision', backgroundColor: '#7E22CE', foregroundColor: '#FFFFFF' },
  road_hazard: { icon: 'warning', backgroundColor: '#FACC15', foregroundColor: '#111827' },
  road_closure: { icon: 'no-entry', backgroundColor: '#B91C1C', foregroundColor: '#FFFFFF' }
};

const GENERIC_MARKER: EventMarkerVisual = {
  icon: 'generic', backgroundColor: '#374151', foregroundColor: '#FFFFFF'
};

export function getEventMarkerVisual(type?: RoadEventType): EventMarkerVisual {
  return type && Object.hasOwn(EVENT_MARKER_VISUALS, type)
    ? EVENT_MARKER_VISUALS[type]
    : GENERIC_MARKER;
}
