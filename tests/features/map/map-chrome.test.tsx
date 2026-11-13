import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MapChrome } from '../../../src/features/map/MapChrome';

vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles }
}));
vi.stubGlobal('React', React);
interface Props {
  children?: ReactNode; accessibilityLabel?: string; disabled?: boolean;
  onPress?: () => void; onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
}
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap((child) => isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function render(overrides: Partial<Parameters<typeof MapChrome>[0]> = {}) {
  const onRecenter = vi.fn(); const onAdd = vi.fn(); const onHeaderHeight = vi.fn();
  const tree = MapChrome({ insets: { top: 32, bottom: 24, left: 0, right: 0 },
    status: 'Удерживайте точку на карте, чтобы добавить событие.', warning: null,
    showHeader: true, showControls: true, canLocate: true,
    onRecenter, onAdd, onHeaderHeight, ...overrides });
  const button = (label: string) => elements(tree).find((node) => node.props.accessibilityLabel === label);
  return { tree, button, onRecenter, onAdd, onHeaderHeight };
}
describe('map chrome', () => {
  it('routes the two quick actions independently', () => {
    const view = render();
    view.button('Моя геопозиция')?.props.onPress?.();
    expect(view.onRecenter).toHaveBeenCalledOnce();
    expect(view.onAdd).not.toHaveBeenCalled();
    view.button('Добавить событие здесь')?.props.onPress?.();
    expect(view.onAdd).toHaveBeenCalledOnce();
  });
  it('disables location-dependent actions when GPS is unavailable', () => {
    const view = render({ canLocate: false });
    expect(view.button('Моя геопозиция')?.props.disabled).toBe(true);
    expect(view.button('Добавить событие здесь')?.props.disabled).toBe(true);
  });
  it('removes quick actions while another map flow is open', () => {
    const view = render({ showControls: false });
    expect(view.button('Моя геопозиция')).toBeUndefined();
    expect(view.button('Добавить событие здесь')).toBeUndefined();
  });
  it('reports actual header height so attribution can follow wrapped text', () => {
    const view = render();
    const header = elements(view.tree).find((node) => node.props.onLayout);
    expect(header).toBeDefined();
    header?.props.onLayout?.({ nativeEvent: { layout: { height: 184 } } });
    expect(view.onHeaderHeight).toHaveBeenCalledExactlyOnceWith(184);
  });
});
