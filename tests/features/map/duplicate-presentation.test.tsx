import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReportLocationControls } from '../../../src/features/map/ReportLocationControls';
import { ReactNativeMapProvider } from '../../../src/features/map/react-native-map-provider';

// Native renderers are unavailable in Node. Exercise the real components' props
// and press contracts; physical layout/camera movement still require the phone.
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles }
}));
vi.mock('@maplibre/maplibre-react-native', () => ({ Camera: 'Camera', Map: 'Map', Marker: 'Marker' }));
vi.stubGlobal('React', React);
interface Props {
  children?: ReactNode; disabled?: boolean; onPress?: () => void;
  center?: number[]; zoom?: number; duration?: number; trackUserLocation?: string;
  accessibilityLiveRegion?: string;
}
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap((child) => isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map((child): string => isValidElement<Props>(child) ? text(child.props.children) : String(child)).join(' ');
}

describe('duplicate presentation', () => {
  it('offers viewing instead of another submission, with accessible feedback', () => {
    const submit = vi.fn(); const view = vi.fn(); const dispatch = vi.fn();
    const tree = ReportLocationControls({ state: { kind: 'duplicate', coordinate: { latitude: 0, longitude: 0 }, eventType: 'accident', existingEventId: 'event' },
      dispatch, onSubmit: submit, onViewExisting: view });
    const nodes = elements(tree);
    const button = nodes.find((node) => node.type === 'Pressable' && text(node.props.children) === 'Посмотреть событие');
    expect(button).toBeDefined();
    button?.props.onPress?.();
    expect(view).toHaveBeenCalledOnce(); expect(submit).not.toHaveBeenCalled();
    expect(nodes.some((node) => node.props.accessibilityLiveRegion === 'polite')).toBe(true);
    expect(text(tree)).toContain('Новая отметка не добавлена');
    nodes.find((node) => node.type === 'Pressable' && text(node.props.children) === 'Отмена')?.props.onPress?.();
    expect(dispatch).toHaveBeenCalledWith({ type: 'cancel' });
  });
  it('disables viewing while loading but leaves cancellation available', () => {
    const tree = ReportLocationControls({ state: { kind: 'viewing-duplicate', coordinate: { latitude: 0, longitude: 0 }, eventType: 'accident', existingEventId: 'event' },
      dispatch: vi.fn(), onSubmit: vi.fn(), onViewExisting: vi.fn() });
    const nodes = elements(tree);
    expect(nodes.find((node) => node.type === 'Pressable' && text(node.props.children) === 'Загрузка события…')?.props.disabled).toBe(true);
    expect(nodes.find((node) => node.type === 'Pressable' && text(node.props.children) === 'Отмена')?.props.disabled).toBe(false);
  });
  it('focuses longitude/latitude and disables GPS tracking without animated motion', () => {
    const tree = ReactNativeMapProvider({ region: { latitude: 42, longitude: 74, latitudeDelta: 0.1, longitudeDelta: 0.1 },
      markers: [], showsUserLocation: true, userLocation: { latitude: 42, longitude: 74 },
      focusTarget: { coordinate: { latitude: 43, longitude: 75 }, requestId: 1 } });
    const camera = elements(tree).find((node) => node.type === 'Camera');
    expect(camera?.props).toMatchObject({ center: [75, 43], zoom: 16, duration: 0 });
    expect(camera?.props.trackUserLocation).toBeUndefined();
  });
});
