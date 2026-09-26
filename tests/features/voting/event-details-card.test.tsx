import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventDetailsCard } from '../../../src/features/map/EventDetailsCard';
import type { VoteCardModel } from '../../../src/features/voting/vote-card-model';

// Verify the real card's element/press contract, not native rendering under Node.
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles }
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.stubGlobal('React', React);
afterEach(() => vi.clearAllMocks());

interface NodeProps {
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  disabled?: boolean;
  onPress?: () => void;
}
function elements(node: ReactNode): ReactElement<NodeProps>[] {
  return Children.toArray(node).flatMap((child) => isValidElement<NodeProps>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map((child): string => isValidElement<NodeProps>(child)
    ? text(child.props.children) : String(child)).join(' ');
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
    voting: { ...voting, ...overrides }, onVote, onDismiss, onRetry
  });
  const button = (label: string) => elements(tree).find((el) => el.props.accessibilityLabel === label)!;
  return { tree, button, onVote, onDismiss, onRetry };
}

describe('event details voting presentation', () => {
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
