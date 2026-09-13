import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EventCardModel } from './map-screen-model';
import { RoadEventMarker } from './RoadEventMarker';

interface EventDetailsCardProps {
  model: EventCardModel;
  onDismiss: () => void;
}

export function EventDetailsCard({
  model,
  onDismiss
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
  }
});
