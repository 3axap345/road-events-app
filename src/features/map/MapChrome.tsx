import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { mapTheme as theme } from './map-theme';

interface Props {
  insets: EdgeInsets;
  status: string;
  warning: string | null;
  showHeader: boolean;
  showControls: boolean;
  canLocate: boolean;
  onHeaderHeight: (height: number) => void;
  onRecenter: () => void;
  onAdd: () => void;
}

export function MapChrome({ insets, status, warning, showHeader, showControls, canLocate,
  onHeaderHeight, onRecenter, onAdd }: Props) {
  return (
    <>
      {showHeader ? (
        <View style={[styles.header, {
          top: insets.top + theme.space.large,
          left: insets.left + theme.space.edge, right: insets.right + theme.space.edge
        }]} onLayout={(event) => onHeaderHeight(event.nativeEvent.layout.height)}>
          <Text accessibilityRole="header" style={styles.title}>Дорожные события</Text>
          <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{status}</Text>
          {warning ? <Text accessibilityRole="alert" style={styles.warning}>{warning}</Text> : null}
        </View>
      ) : null}
      {showControls ? (
        <View pointerEvents="box-none" style={[styles.controls, {
          right: insets.right + theme.space.edge, bottom: Math.max(24, insets.bottom + theme.space.large)
        }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Моя геопозиция"
            accessibilityState={{ disabled: !canLocate }} disabled={!canLocate} onPress={onRecenter}
            style={({ pressed }) => [styles.button, !canLocate && styles.disabled, pressed && styles.pressed]}>
            <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.crosshair}>
              <View style={styles.crosshairDot} />
              <View style={[styles.tick, styles.tickTop]} /><View style={[styles.tick, styles.tickBottom]} />
              <View style={[styles.tick, styles.tickLeft]} /><View style={[styles.tick, styles.tickRight]} />
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Добавить событие здесь"
            accessibilityHint="Открывает выбор типа события в вашей текущей геопозиции"
            accessibilityState={{ disabled: !canLocate }} disabled={!canLocate} onPress={onAdd}
            style={({ pressed }) => [styles.button, styles.addButton, !canLocate && styles.disabled, pressed && styles.pressed]}>
            <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.plus}>
              <View style={styles.plusHorizontal} /><View style={styles.plusVertical} />
            </View>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute', borderRadius: theme.radius.panel, backgroundColor: theme.colors.surface,
    padding: theme.space.edge, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  subtitle: { marginTop: theme.space.small, fontSize: 13, lineHeight: 19, color: theme.colors.secondaryText },
  warning: { marginTop: theme.space.medium, fontSize: 13, color: theme.colors.danger },
  controls: { position: 'absolute', gap: theme.space.large },
  button: {
    width: theme.size.button, height: theme.size.button, borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', ...theme.shadow
  },
  addButton: { backgroundColor: theme.colors.primary },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  crosshair: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  crosshairDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  tick: { position: 'absolute', backgroundColor: theme.colors.text },
  tickTop: { top: -5, width: 2, height: 5 },
  tickBottom: { bottom: -5, width: 2, height: 5 },
  tickLeft: { left: -5, width: 5, height: 2 },
  tickRight: { right: -5, width: 5, height: 2 },
  plus: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  plusHorizontal: { position: 'absolute', width: 24, height: 3, borderRadius: 2, backgroundColor: theme.colors.surface },
  plusVertical: { position: 'absolute', width: 3, height: 24, borderRadius: 2, backgroundColor: theme.colors.surface }
});
