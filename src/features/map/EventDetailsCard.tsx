import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EventCardModel } from './map-screen-model';
import { RoadEventMarker } from './RoadEventMarker';
import { mapTheme } from './map-theme';
import type { EventVoteType } from '../events/types';
import type { VoteCardModel } from '../voting/vote-card-model';

interface EventDetailsCardProps {
  model: EventCardModel;
  onDismiss: () => void;
  voting: VoteCardModel;
  onVote: (voteType: EventVoteType) => void;
  onRetry: () => void;
  /** Bottom edge of the map attribution's reserved touch area. */
  topBoundary: number;
}

export function EventDetailsCard({
  model, onDismiss, voting, onVote, onRetry, topBoundary
}: EventDetailsCardProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return (
    <View pointerEvents="box-none" style={[styles.placement, {
      top: Math.max(topBoundary, insets.top + mapTheme.space.large),
      bottom: Math.max(24, insets.bottom + mapTheme.space.large),
      left: insets.left + mapTheme.space.edge,
      right: insets.right + mapTheme.space.edge
    }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <RoadEventMarker eventType={model.eventType} label={model.title} variant="map" />
          </View>
          <View style={styles.summary}>
            <Text accessibilityRole="header" style={styles.title}>{model.title}</Text>
            <Text style={styles.meta}>{model.ageLabel}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close event details"
            onPress={onDismiss} style={styles.closeButton}
            android_ripple={{ color: mapTheme.colors.border, borderless: true }}>
            <View pointerEvents="none" style={styles.closeLine} />
            <View pointerEvents="none" style={[styles.closeLine, styles.closeCross]} />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
          <View style={styles.counts}>
            <Text style={[styles.countText, styles.count]}>{voting.confirmationLabel}</Text>
            <Text style={[styles.meta, styles.count]}>{voting.goneLabel}</Text>
          </View>

          {voting.notice ? (
            <View style={styles.notice}>
              {voting.busy ? <ActivityIndicator accessible={false} color={mapTheme.colors.primaryText} /> : null}
              <Text accessibilityLiveRegion="polite" style={[styles.meta, styles.noticeText]}>{voting.notice}</Text>
            </View>
          ) : null}

          {voting.actions.length > 0 ? (
            <View style={styles.actions}>
              {voting.actions.map((action) => (
                <Pressable key={action.voteType} accessibilityRole="button" accessibilityLabel={action.label}
                  accessibilityState={{ selected: action.selected, disabled: voting.disabled, busy: voting.busy }}
                  disabled={voting.disabled} onPress={() => onVote(action.voteType)}
                  android_ripple={{ color: mapTheme.colors.border }}
                  style={[styles.voteButton, { flexBasis: 144 * fontScale },
                    voting.disabled && styles.disabledButton, action.selected && styles.selectedButton]}>
                  {action.selected ? <View accessible={false} style={styles.check} /> : null}
                  <Text style={[styles.voteText, action.selected && styles.selectedText]}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {voting.error ? (
            <View style={styles.error}>
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{voting.error}</Text>
            </View>
          ) : null}
          {voting.retryLabel ? (
            <Pressable accessibilityRole="button" accessibilityLabel={voting.retryLabel}
              accessibilityState={{ disabled: voting.busy, busy: voting.busy }}
              onPress={onRetry} disabled={voting.busy} style={styles.retryButton}
              android_ripple={{ color: mapTheme.colors.primarySurface }}>
              <Text style={[styles.voteText, styles.selectedText]}>{voting.retryLabel}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placement: { position: 'absolute', justifyContent: 'flex-end' },
  card: {
    maxHeight: '100%',
    borderRadius: mapTheme.radius.panel,
    backgroundColor: mapTheme.colors.surface,
    ...mapTheme.shadow
  },
  scroll: { flexShrink: 1, borderRadius: mapTheme.radius.panel },
  content: { paddingHorizontal: mapTheme.space.edge, paddingBottom: mapTheme.space.edge },
  header: { flexDirection: 'row', alignItems: 'center', gap: mapTheme.space.large, padding: mapTheme.space.edge },
  summary: { flex: 1, minWidth: 0, gap: mapTheme.space.small },
  title: { fontSize: 20, fontWeight: '700', color: mapTheme.colors.text },
  meta: { fontSize: 14, color: mapTheme.colors.secondaryText },
  counts: {
    flexDirection: 'row', flexWrap: 'wrap', columnGap: mapTheme.space.edge,
    rowGap: mapTheme.space.medium,
    paddingTop: mapTheme.space.edge, borderTopWidth: 1, borderTopColor: mapTheme.colors.border
  },
  countText: { fontSize: 14, fontWeight: '600', color: mapTheme.colors.text },
  count: {
    // Give wrapped counters the available row width for Android text measurement.
    flexGrow: 1, flexShrink: 1, maxWidth: '100%'
  },
  notice: { flexDirection: 'row', alignItems: 'center', gap: mapTheme.space.medium, marginTop: mapTheme.space.edge },
  noticeText: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: mapTheme.space.medium, marginTop: mapTheme.space.edge },
  voteButton: {
    flexGrow: 1, flexShrink: 1, minHeight: mapTheme.size.button,
    paddingHorizontal: mapTheme.space.large, paddingVertical: mapTheme.space.large,
    borderRadius: mapTheme.radius.button, borderWidth: 2, borderColor: mapTheme.colors.border,
    flexDirection: 'row', gap: mapTheme.space.medium, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
  },
  selectedButton: { backgroundColor: mapTheme.colors.primarySurface, borderColor: mapTheme.colors.primary },
  disabledButton: { backgroundColor: mapTheme.colors.mutedSurface },
  voteText: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: mapTheme.colors.text, textAlign: 'center' },
  selectedText: { color: mapTheme.colors.primaryText },
  check: {
    width: 12, height: 7, borderLeftWidth: 2, borderBottomWidth: 2,
    borderColor: mapTheme.colors.primaryText, transform: [{ rotate: '-45deg' }], marginBottom: 4
  },
  error: { marginTop: mapTheme.space.edge, padding: mapTheme.space.large, borderRadius: mapTheme.radius.button, backgroundColor: mapTheme.colors.dangerSurface },
  errorText: { fontSize: 14, color: mapTheme.colors.danger },
  retryButton: {
    minHeight: mapTheme.size.button, marginTop: mapTheme.space.medium,
    padding: mapTheme.space.large, borderRadius: mapTheme.radius.button,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
  },
  closeButton: {
    flexShrink: 0,
    width: 48, height: 48, borderRadius: mapTheme.radius.marker,
    backgroundColor: mapTheme.colors.surface, alignItems: 'center', justifyContent: 'center'
  },
  closeLine: { position: 'absolute', width: 20, height: 2, backgroundColor: mapTheme.colors.secondaryText, transform: [{ rotate: '45deg' }] },
  closeCross: { transform: [{ rotate: '-45deg' }] }
});
