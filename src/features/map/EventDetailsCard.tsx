import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EventCardModel } from './map-screen-model';

interface EventDetailsCardProps {
  model: EventCardModel;
  onDismiss: () => void;
}

export function EventDetailsCard({
  model,
  onDismiss
}: EventDetailsCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{model.title}</Text>

        <Pressable
          accessibilityLabel="Закрыть карточку события"
          hitSlop={12}
          onPress={onDismiss}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <Text style={styles.meta}>{model.ageLabel}</Text>

      <Text style={styles.meta}>
        {model.confirmationLabel}
      </Text>

      {model.lastConfirmationLabel ? (
        <Text style={styles.meta}>
          {model.lastConfirmationLabel}
        </Text>
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
    padding: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827'
  },
  closeButton: {
    marginLeft: 12,
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