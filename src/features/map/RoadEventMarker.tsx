import { StyleSheet, Text, View } from 'react-native';

import type { RoadEventType } from '../events/types';
import { getEventMarkerVisual } from './event-marker-visual';

export function RoadEventMarker({ eventType, label }: { eventType?: RoadEventType; label: string }) {
  const visual = getEventMarkerVisual(eventType);
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
