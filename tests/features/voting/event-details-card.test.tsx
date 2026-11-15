import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { TextStyle } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoadEventMarker } from '../../../src/features/map/RoadEventMarker';
import { EventDetailsCard } from '../../../src/features/map/EventDetailsCard';
import type { VoteCardModel } from '../../../src/features/voting/vote-card-model';

const device = vi.hoisted(() => ({ fontScale: 1, insets: { top: 32, bottom: 24, left: 0, right: 0 } }));

// Verify the real card's element/press contract, not native rendering under Node.
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  useWindowDimensions: () => ({ width: 393, height: 873, scale: 2.75, fontScale: device.fontScale }),
  StyleSheet: { create: (styles: unknown) => styles }
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => device.insets }));
vi.stubGlobal('React', React);
afterEach(() => { vi.clearAllMocks(); device.fontScale = 1; });

interface NodeProps {
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean; busy?: boolean };
  accessibilityRole?: string;
  accessibilityLiveRegion?: string;
  pointerEvents?: string;
  variant?: string;
  disabled?: boolean;
  onPress?: () => void;
  style?: TextStyle | TextStyle[];
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
}
function elements(node: ReactNode): ReactElement<NodeProps>[] {
  return Children.toArray(node).flatMap((child) => isValidElement<NodeProps>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map((child): string => isValidElement<NodeProps>(child)
    ? text(child.props.children) : String(child)).join(' ');
}
function style(node: ReactElement<NodeProps>) {
  return Object.assign({}, ...[node.props.style].flat()) as TextStyle;
}
const voting: VoteCardModel = {
  confirmationLabel: '3 confirmations', goneLabel: '2 no longer there', disabled: false, busy: false,
  notice: null, error: null, retryLabel: null,
  actions: [
    { voteType: 'confirm', label: 'Confirm', selected: true },
    { voteType: 'gone', label: 'No longer there', selected: false }
  ]
};
function render(overrides: Partial<VoteCardModel> = {}) {
  const onVote = vi.fn(); const onDismiss = vi.fn(); const onRetry = vi.fn();
  const tree = EventDetailsCard({
    model: { eventType: 'accident', title: 'Accident', ageLabel: 'Just now' },
    voting: { ...voting, ...overrides }, onVote, onDismiss, onRetry, topBoundary: 240
  });
  const button = (label: string) => elements(tree).find((el) => el.props.accessibilityLabel === label)!;
  return { tree, button, onVote, onDismiss, onRetry };
}

describe('event details voting presentation', () => {
  it('bounds the scrollable card below attribution and above the system navigation area', () => {
    const { tree } = render();
    expect(style(tree)).toMatchObject({ top: 240, bottom: 36, left: 16, right: 16 });
    expect(tree.props.pointerEvents).toBe('box-none');
    const surface = Children.toArray(tree.props.children)[0] as ReactElement<NodeProps>;
    expect(style(surface).maxHeight).toBe('100%');
    const scroll = elements(tree).find((node) => node.type === 'ScrollView');
    expect(scroll).toBeDefined();
    expect(style(scroll!)).toMatchObject({ flexShrink: 1 });
    expect(elements(scroll).some((node) => node.props.accessibilityLabel === 'Confirm')).toBe(true);
    // Closing remains available even when the card content is scrolled.
    expect(elements(scroll).some((node) => node.props.accessibilityLabel === 'Close event details')).toBe(false);
  });

  it('uses the same event icon as the map markers', () => {
    const marker = elements(render().tree).find((node) => node.type === RoadEventMarker);
    expect(marker?.props.variant).toBe('map');
  });

  it('keeps the heading and close control outside scrolling actions so they cannot overlap', () => {
    const { tree, button } = render();
    const scroll = elements(tree).find((node) => node.type === 'ScrollView');
    expect(scroll).toBeDefined();
    expect(elements(scroll).some((node) => node.props.accessibilityRole === 'header')).toBe(false);
    expect(style(button('Close event details')).position).not.toBe('absolute');
  });

  it('lets large-font action buttons wrap into full rows without fixed text heights', () => {
    const normal = render();
    device.fontScale = 1.3;
    const large = render();
    const actions = elements(large.tree).find((node) =>
      Children.toArray(node.props.children).some((child) =>
        isValidElement<NodeProps>(child) && child.props.accessibilityLabel === 'Confirm'));
    expect(style(actions!)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    for (const label of ['Confirm', 'No longer there']) {
      expect(style(large.button(label)).flexBasis).toBeGreaterThan(style(normal.button(label)).flexBasis as number);
      expect(style(large.button(label))).toMatchObject({ flexGrow: 1, flexShrink: 1, minHeight: 56 });
      expect(style(large.button(label)).height).toBeUndefined();
    }
    for (const node of elements(large.tree).filter((node) => node.type === 'Text')) {
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
      expect(node.props.adjustsFontSizeToFit).not.toBe(true);
    }
  });

  it('announces progress and exposes busy state without replacing the vote labels', () => {
    const card = render({ disabled: true, busy: true, notice: 'Saving vote…' });
    const notice = elements(card.tree).find((node) => node.props.accessibilityLiveRegion === 'polite');
    expect(text(notice)).toContain('Saving vote…');
    expect(elements(card.tree).some((node) => node.type === 'ActivityIndicator')).toBe(true);
    expect(card.button('Confirm').props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(text(card.button('Confirm'))).toContain('Confirm');
  });

  it.each(['Retry loading', 'Retry vote', 'Retry refresh'])('routes %s to recovery without casting another vote', (retryLabel) => {
    const card = render({ error: 'Connection unavailable.', retryLabel });
    const alert = elements(card.tree).find((node) => node.props.accessibilityRole === 'alert');
    expect(text(alert)).toContain('Connection unavailable.');
    card.button(retryLabel).props.onPress?.();
    expect(card.onRetry).toHaveBeenCalledOnce();
    expect(card.onVote).not.toHaveBeenCalled();
  });
  it('gives counters available row width without restricting text scaling or wrapping', () => {
    // This is a layout contract, not a simulation of Android text measurement.
    // The original clipping must also be checked on native devices.
    const card = render({ confirmationLabel: '1 confirmation', goneLabel: '0 no longer there' });
    for (const label of ['1 confirmation', '0 no longer there']) {
      const counter = elements(card.tree).find((el) => el.type === 'Text' && el.props.children === label);
      expect(counter).toBeDefined();
      const props = counter!.props;
      const style = Object.assign({}, ...[props.style].flat()) as TextStyle;
      expect(style.flexGrow).toBe(1);
      expect(style.flexShrink).toBe(1);
      expect(style.maxWidth).toBe('100%');
      expect(style.height).toBeUndefined();
      expect(style.maxHeight).toBeUndefined();
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
      expect(props.adjustsFontSizeToFit).not.toBe(true);
    }
  });

  it('renders counters and selected vote with existing title/time/close', () => {
    const card = render();
    expect(text(card.tree)).toContain('3 confirmations');
    expect(text(card.tree)).toContain('2 no longer there');
    expect(text(card.tree)).toContain('Accident');
    expect(card.button('Confirm').props.accessibilityState?.selected).toBe(true);
    expect(card.button('No longer there').props.accessibilityState?.selected).toBe(false);
    card.button('No longer there').props.onPress?.();
    expect(card.onVote).toHaveBeenCalledExactlyOnceWith('gone');
    card.button('Close event details').props.onPress?.();
    expect(card.onDismiss).toHaveBeenCalledOnce();
  });
  it('disables both actions while pending and renders a refresh-only recovery action', () => {
    const pending = render({ disabled: true, busy: true, notice: 'Saving vote…' });
    expect(pending.button('Confirm').props.disabled).toBe(true);
    expect(pending.button('No longer there').props.disabled).toBe(true);
    const failedRead = render({ disabled: true, error: 'Vote saved. Could not refresh the details.', retryLabel: 'Retry refresh' });
    failedRead.button('Retry refresh').props.onPress?.();
    expect(failedRead.onRetry).toHaveBeenCalledOnce();
    expect(failedRead.onVote).not.toHaveBeenCalled();
  });
  it('shows counts but no actions for the reporter', () => {
    const card = render({ actions: [], notice: 'You reported this event. Others can validate it.' });
    expect(card.button('Confirm')).toBeUndefined();
    expect(text(card.tree)).toContain('3 confirmations');
    expect(text(card.tree)).toContain('You reported this event.');
  });
});
