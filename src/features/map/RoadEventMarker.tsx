import { StyleSheet, Text, View } from 'react-native';

import type { RoadEventType } from '../events/types';
import { getEventMarkerVisual } from './event-marker-visual';
import { mapTheme } from './map-theme';

export function RoadEventMarker({ eventType, label, variant = 'compact' }: {
  eventType?: RoadEventType; label: string; variant?: 'compact' | 'map';
}) {
  const visual = getEventMarkerVisual(eventType);
  if (variant === 'map') {
    const backgroundColor = eventType === 'road_check' ? mapTheme.colors.primary
      : eventType === 'accident' ? mapTheme.colors.accident
        : eventType === 'road_hazard' ? mapTheme.colors.hazard : mapTheme.colors.closure;
    return (
      <View accessible accessibilityLabel={label} pointerEvents="none" style={styles.mapOutline}>
        <View style={[styles.mapBadge, { backgroundColor }]}>
          {visual.icon === 'collision' ? (
            <View style={styles.car}>
              <View style={styles.windshield} />
              <View style={[styles.headlight, { left: 3 }]} />
              <View style={[styles.headlight, { right: 3 }]} />
              <View style={[styles.wheel, { left: 1 }]} />
              <View style={[styles.wheel, { right: 1 }]} />
            </View>
          ) : visual.icon === 'warning' ? (
            <View style={styles.mapWarning}>
              <View style={styles.warningStem} /><View style={styles.warningDot} />
            </View>
          ) : visual.icon === 'shield' ? (
            <View style={styles.mapShield}><View style={styles.shieldStripe} /></View>
          ) : (
            <View style={styles.closureRing}><View style={styles.closureBar} /></View>
          )}
        </View>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel={label} pointerEvents="none" style={styles.outline}>
      <View style={[styles.badge, { backgroundColor: visual.backgroundColor }]}>
        {visual.icon === 'shield' ? (
          <View style={[styles.shield, { backgroundColor: visual.foregroundColor }]}>
            <Text allowFontScaling={false} style={[styles.star, { color: visual.backgroundColor }]}>★</Text>
          </View>
        ) : visual.icon === 'warning' ? (
          <View style={styles.warning}>
            <View style={[styles.triangle, { borderBottomColor: visual.foregroundColor }]} />
            <Text allowFontScaling={false} style={[styles.exclamation, { color: visual.backgroundColor }]}>!</Text>
          </View>
        ) : visual.icon === 'no-entry' ? (
          <View style={[styles.bar, { backgroundColor: visual.foregroundColor }]} />
        ) : (
          <Text allowFontScaling={false} style={[styles.symbol, { color: visual.foregroundColor }]}>
            {visual.icon === 'collision' ? '✹' : '?'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapOutline: {
    width: mapTheme.size.marker, height: mapTheme.size.marker,
    borderRadius: mapTheme.radius.marker, padding: 3,
    backgroundColor: mapTheme.colors.surface, ...mapTheme.shadow
  },
  mapBadge: { flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  car: { width: 24, height: 21, borderRadius: 5, backgroundColor: '#FFFFFF' },
  windshield: { position: 'absolute', top: 3, left: 4, right: 4, height: 7, borderRadius: 2, backgroundColor: mapTheme.colors.accident },
  headlight: { position: 'absolute', bottom: 4, width: 4, height: 3, borderRadius: 1, backgroundColor: mapTheme.colors.accident },
  wheel: { position: 'absolute', bottom: -3, width: 5, height: 5, borderRadius: 1, backgroundColor: '#FFFFFF' },
  mapWarning: { width: 26, height: 26, borderWidth: 2, borderColor: mapTheme.colors.text, borderRadius: 7, alignItems: 'center', justifyContent: 'center', gap: 3 },
  warningStem: { width: 3, height: 10, borderRadius: 1, backgroundColor: mapTheme.colors.text },
  warningDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: mapTheme.colors.text },
  mapShield: { width: 22, height: 26, borderWidth: 2, borderColor: '#FFFFFF', borderTopLeftRadius: 5, borderTopRightRadius: 5, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shieldStripe: { width: 10, height: 3, borderRadius: 1, backgroundColor: '#FFFFFF' },
  closureRing: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  closureBar: { width: 14, height: 4, borderRadius: 1, backgroundColor: '#FFFFFF' },
  outline: { width: 36, height: 36, borderRadius: 18, padding: 1, backgroundColor: '#111827' },
  badge: { flex: 1, borderRadius: 17, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shield: { width: 17, height: 20, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, alignItems: 'center', justifyContent: 'center' },
  star: { fontSize: 13, lineHeight: 17, includeFontPadding: false, textAlign: 'center' },
  symbol: { fontSize: 25, lineHeight: 28, fontWeight: 'bold', includeFontPadding: false, textAlign: 'center' },
  warning: { width: 22, height: 21, alignItems: 'center' },
  triangle: { width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 21, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  exclamation: { position: 'absolute', top: 5, fontSize: 15, lineHeight: 16, fontWeight: 'bold', includeFontPadding: false },
  bar: { width: 19, height: 5, borderRadius: 1 }
});
