import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { TextStyle } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReportLocationControls } from '../../../src/features/map/ReportLocationControls';
import { RoadEventMarker } from '../../../src/features/map/RoadEventMarker';
import type { ReportLocationState } from '../../../src/features/map/report-location';

const device = vi.hoisted(() => ({ fontScale: 1 }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  useWindowDimensions: () => ({ width: 393, height: 873, fontScale: device.fontScale, scale: 2.75 }),
  StyleSheet: { create: (styles: unknown) => styles }
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 32, bottom: 24, left: 8, right: 4 }) }));
vi.stubGlobal('React', React);
afterEach(() => { device.fontScale = 1; });

// Element/handler contracts only: Node cannot measure Android text or run Yoga layout.
interface Props {
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { checked?: boolean; disabled?: boolean; busy?: boolean };
  accessibilityLiveRegion?: string;
  disabled?: boolean;
  onPress?: () => void;
  style?: TextStyle | (TextStyle | false)[];
  pointerEvents?: string;
  eventType?: string;
  variant?: string;
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
}
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap((child) => isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map((child): string => isValidElement<Props>(child)
    ? text(child.props.children) : String(child)).join(' ');
}
function style(node: ReactElement<Props>) {
  return Object.assign({}, ...[node.props.style].flat()) as TextStyle;
}
const draft = { coordinate: { latitude: 42.8746, longitude: 74.6 }, eventType: 'accident' as const };
function render(state: ReportLocationState) {
  const dispatch = vi.fn();
  const onSubmit = vi.fn(async () => {});
  const onViewExisting = vi.fn(async () => {});
  const tree = ReportLocationControls({ state, dispatch, onSubmit, onViewExisting, topBoundary: 112 });
  const button = (label: string) => elements(tree).find((node) => node.props.accessibilityLabel === label)!;
  return { tree, button, dispatch, onSubmit, onViewExisting };
}

describe('report location UI', () => {
  it('renders nothing while idle', () => {
    expect(render({ kind: 'idle', coordinate: null, eventType: null }).tree).toBeNull();
  });

  it('offers exactly four Russian event types using the matching map icons', () => {
    const card = render({ kind: 'choosing-type', ...draft });
    const radios = elements(card.tree).filter((node) => node.props.accessibilityRole === 'radio');
    expect(radios.map((node) => node.props.accessibilityLabel)).toEqual(expect.arrayContaining(['ДТП', 'Опасность', 'Перекрытие', 'Дорожная проверка']));
    expect(radios).toHaveLength(4);
    for (const [label, eventType] of [['ДТП', 'accident'], ['Опасность', 'road_hazard'], ['Перекрытие', 'road_closure'], ['Дорожная проверка', 'road_check']] as const) {
      const radio = card.button(label);
      expect(radio.props.accessibilityState?.checked).toBe(eventType === 'accident');
      expect(elements(radio).find((node) => node.type === RoadEventMarker)?.props).toMatchObject({ eventType, variant: 'map' });
      radio.props.onPress?.();
      expect(card.dispatch).toHaveBeenLastCalledWith({ type: 'select-type', eventType });
    }
    expect(card.onSubmit).not.toHaveBeenCalled();
  });

  it('requires a type and continues locally before allowing submission', () => {
    const empty = render({ kind: 'choosing-type', coordinate: draft.coordinate, eventType: null });
    expect(empty.button('Продолжить').props.disabled).toBe(true);
    const selected = render({ kind: 'choosing-type', ...draft });
    expect(selected.button('Продолжить').props.disabled).toBe(false);
    selected.button('Продолжить').props.onPress?.();
    expect(selected.dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'continue' });
    expect(selected.onSubmit).not.toHaveBeenCalled();
  });

  it('shows a readable draft summary and submits only on an explicit press', () => {
    const card = render({ kind: 'ready', ...draft });
    expect(text(card.tree)).toContain('ДТП');
    expect(text(card.tree)).toContain('42.87460');
    expect(text(card.tree)).toContain('74.60000');
    expect(text(card.tree)).not.toContain('accident');
    expect(card.onSubmit).not.toHaveBeenCalled();
    card.button('Отправить').props.onPress?.();
    expect(card.onSubmit).toHaveBeenCalledOnce();
    expect(card.onViewExisting).not.toHaveBeenCalled();
  });

  it('keeps back and cancellation routed to their original actions', () => {
    const card = render({ kind: 'ready', ...draft });
    card.button('Назад').props.onPress?.();
    card.button('Отмена').props.onPress?.();
    expect(card.dispatch.mock.calls).toEqual([[{ type: 'back' }], [{ type: 'cancel' }]]);
    expect(card.onSubmit).not.toHaveBeenCalled();
  });

  it('locks all actions while submitting and announces progress', () => {
    const card = render({ kind: 'submitting', ...draft });
    for (const label of ['Назад', 'Отмена', 'Отправка…']) {
      expect(card.button(label).props.disabled).toBe(true);
      expect(card.button(label).props.accessibilityState?.disabled).toBe(true);
    }
    expect(card.button('Отправка…').props.accessibilityState?.busy).toBe(true);
    expect(elements(card.tree).some((node) => node.type === 'ActivityIndicator')).toBe(true);
    expect(elements(card.tree).some((node) => node.props.accessibilityLiveRegion === 'polite' && text(node).includes('Отправка…'))).toBe(true);
  });

  it.each([
    'Не удалось отправить событие. Проверьте соединение и повторите попытку.',
    'Вы достигли лимита: 3 события за 10 минут. Попробуйте позже.',
    'Вы достигли лимита: 15 событий за 24 часа. Попробуйте позже.'
  ])('displays the supplied error without an automatic retry: %s', (error) => {
    const card = render({ kind: 'ready', ...draft, error });
    const alert = elements(card.tree).find((node) => node.props.accessibilityRole === 'alert');
    expect(text(alert)).toBe(error);
    expect(card.onSubmit).not.toHaveBeenCalled();
    expect(card.button('Отправить').props.disabled).toBe(false);
    card.button('Отправить').props.onPress?.();
    expect(card.onSubmit).toHaveBeenCalledOnce();
  });

  it('keeps the whole form including recovery and cancellation inside a bounded scroll area', () => {
    const { tree } = render({ kind: 'ready', ...draft, error: 'Connection unavailable' });
    expect(style(tree!)).toMatchObject({ top: 112, bottom: 36, left: 24, right: 20, justifyContent: 'flex-end' });
    expect(tree!.props.pointerEvents).toBe('box-none');
    const scroll = elements(tree).find((node) => node.type === 'ScrollView');
    expect(scroll).toBeDefined();
    expect(style(scroll!).flexShrink).toBe(1);
    for (const label of ['Назад', 'Отмена', 'Отправить']) {
      expect(elements(scroll).some((node) => node.props.accessibilityLabel === label)).toBe(true);
    }
    const panel = Children.toArray(tree!.props.children)[0] as ReactElement<Props>;
    expect(style(panel).maxHeight).toBe('100%');
  });

  it('allows type cards and all text to wrap as system font size grows', () => {
    const normal = render({ kind: 'choosing-type', ...draft });
    // Force one column in a 320 dp viewport even before Yoga accounts for the gap.
    const narrowContentWidth = 320 - 2 * 16 - 2 * 16;
    expect((style(normal.button('ДТП')).flexBasis as number) * 2).toBeGreaterThan(narrowContentWidth);
    device.fontScale = 1.3;
    const large = render({ kind: 'choosing-type', ...draft });
    expect(style(large.button('ДТП')).flexBasis).toBeGreaterThan(style(normal.button('ДТП')).flexBasis as number);
    const group = elements(large.tree).find((node) => node.props.accessibilityRole === 'radiogroup');
    expect(style(group!)).toMatchObject({ flexWrap: 'wrap', flexDirection: 'row' });
    for (const node of elements(large.tree).filter((node) => node.type === 'Text')) {
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
      expect(node.props.adjustsFontSizeToFit).not.toBe(true);
    }
  });
});
