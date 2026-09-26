import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EventCardModel } from './map-screen-model';
import { RoadEventMarker } from './RoadEventMarker';
import type { EventVoteType } from '../events/types';
import type { VoteCardModel } from '../voting/vote-card-model';

interface EventDetailsCardProps {
  model: EventCardModel;
  onDismiss: () => void;
  voting: VoteCardModel;
  onVote: (voteType: EventVoteType) => void;
  onRetry: () => void;
}

export function EventDetailsCard({
  model,
  onDismiss,
  voting,
  onVote,
  onRetry
}: EventDetailsCardProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.card, { bottom: Math.max(24, insets.bottom + 12) }]}>
      <View style={styles.header}>
        <RoadEventMarker eventType={model.eventType} label={model.title} />
        <View style={styles.summary}>
          <Text accessibilityRole="header" style={styles.title}>{model.title}</Text>
          <Text style={styles.meta}>{model.ageLabel}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close event details"
          onPress={onDismiss}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <View style={styles.counts}>
        <Text style={styles.meta}>{voting.confirmationLabel}</Text>
        <Text style={styles.meta}>{voting.goneLabel}</Text>
      </View>
      {voting.notice ? <Text accessibilityLiveRegion="polite" style={styles.meta}>{voting.notice}</Text> : null}
      {voting.actions.length > 0 ? (
        <View style={styles.actions}>
          {voting.actions.map((action) => (
            <Pressable key={action.voteType} accessibilityRole="button" accessibilityLabel={action.label}
              accessibilityState={{ selected: action.selected, disabled: voting.disabled, busy: voting.busy }}
              disabled={voting.disabled} onPress={() => onVote(action.voteType)}
              style={[styles.voteButton, action.selected && styles.selectedButton, voting.disabled && styles.disabledButton]}>
              <Text style={[styles.voteText, action.selected && styles.selectedText]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {voting.error ? <Text accessibilityRole="alert" style={styles.errorText}>{voting.error}</Text> : null}
      {voting.retryLabel ? (
        <Pressable accessibilityRole="button" accessibilityLabel={voting.retryLabel}
          onPress={onRetry} disabled={voting.busy} style={styles.retryButton}>
          <Text style={styles.voteText}>{voting.retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  summary: {
    flex: 1,
    marginLeft: 12
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827'
  },
  closeButton: {
    marginLeft: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontSize: 28,
    lineHeight: 28,
    color: '#4B5563'
  },
  meta: {
    marginTop: 6,
    fontSize: 14,
    color: '#4B5563'
  },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    marginTop: 6
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  voteButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedButton: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  disabledButton: { opacity: 0.6 },
  voteText: { fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'center' },
  selectedText: { color: '#FFFFFF' },
  errorText: { marginTop: 10, fontSize: 13, color: '#991B1B' },
  retryButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8
  }
});
