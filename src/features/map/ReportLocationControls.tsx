import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROAD_EVENT_TYPES, type RoadEventType } from '../events/types';
import type { ReportLocationAction, ReportLocationState } from './report-location';
import { RoadEventMarker } from './RoadEventMarker';
import { mapTheme } from './map-theme';

const TYPE_LABELS: Record<RoadEventType, string> = {
  road_check: 'Дорожная проверка',
  accident: 'ДТП',
  road_hazard: 'Опасность',
  road_closure: 'Перекрытие'
};

interface Props {
  state: ReportLocationState;
  dispatch: (action: ReportLocationAction) => void;
  onSubmit: () => Promise<void>;
  onViewExisting: () => Promise<void>;
  /** Keep the panel below the map attribution's touch area. */
  topBoundary: number;
}

export function ReportLocationControls({ state, dispatch, onSubmit, onViewExisting, topBoundary }: Props) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  if (state.kind === 'idle') return null;
  const submitting = state.kind === 'submitting';
  const duplicate = state.kind === 'duplicate' || state.kind === 'viewing-duplicate';
  const viewing = state.kind === 'viewing-duplicate';
  const canContinue = (state.kind === 'choosing-type' && state.eventType !== null)
    || state.kind === 'ready';
  const primaryDisabled = duplicate ? viewing : !canContinue;
  const primaryLabel = viewing ? 'Загрузка события…' : duplicate ? 'Посмотреть событие'
    : submitting ? 'Отправка…' : state.kind === 'choosing-type' ? 'Продолжить' : 'Отправить';

  return (
    <View pointerEvents="box-none" style={[styles.container, {
      top: Math.max(topBoundary, insets.top + mapTheme.space.large),
      bottom: Math.max(24, insets.bottom + mapTheme.space.large),
      left: insets.left + mapTheme.space.edge,
      right: insets.right + mapTheme.space.edge
    }]}>
      <View style={styles.panel}>
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.panelContent} bounces={false}>
          <Text accessibilityRole="header" style={styles.title}>
            {duplicate ? 'Уже есть на карте' : state.kind === 'choosing-type' ? 'Что произошло?' : 'Проверьте событие'}
          </Text>
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {duplicate ? 'Такое событие уже отмечено рядом. Новая отметка не добавлена.'
              : state.kind === 'choosing-type' ? 'Выберите тип события. Удерживайте другую точку на карте, чтобы изменить место.'
                : 'Проверьте тип и выбранную точку перед отправкой.'}
          </Text>

          {state.kind === 'choosing-type' ? (
            <View accessibilityRole="radiogroup" accessibilityLabel="Тип события" style={styles.options}>
              {ROAD_EVENT_TYPES.map((eventType) => {
                const selected = state.eventType === eventType;
                return (
                  <Pressable key={eventType} accessibilityRole="radio" accessibilityLabel={TYPE_LABELS[eventType]}
                    accessibilityState={{ checked: selected }}
                    android_ripple={{ color: mapTheme.colors.border }}
                    style={[styles.option, { flexBasis: 144 * fontScale }, selected && styles.selectedOption]}
                    onPress={() => dispatch({ type: 'select-type', eventType })}>
                    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      <RoadEventMarker eventType={eventType} label={TYPE_LABELS[eventType]} variant="map" />
                    </View>
                    <Text style={[styles.optionLabel, selected && styles.selectedText]}>{TYPE_LABELS[eventType]}</Text>
                    <View accessible={false} style={[styles.radio, selected && styles.selectedRadio]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.summary}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <RoadEventMarker eventType={state.eventType} label={TYPE_LABELS[state.eventType]} variant="map" />
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.eventTitle}>{TYPE_LABELS[state.eventType]}</Text>
                <Text style={styles.location}>Точка на карте: {state.coordinate.latitude.toFixed(5)}, {state.coordinate.longitude.toFixed(5)}</Text>
              </View>
            </View>
          )}

          {'error' in state && state.error ? (
            <View style={styles.errorPanel}>
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{state.error}</Text>
            </View>
          ) : null}
          {submitting || viewing ? (
            <View style={styles.progress}>
              <ActivityIndicator accessible={false} color={mapTheme.colors.primaryText} />
              <Text style={styles.progressText} accessibilityLiveRegion="polite">{primaryLabel}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={primaryLabel}
              accessibilityState={{ disabled: primaryDisabled, busy: submitting || viewing }}
              disabled={primaryDisabled}
              style={[styles.button, primaryDisabled && styles.disabled]}
              android_ripple={{ color: mapTheme.colors.primaryText }}
              onPress={() => duplicate ? void onViewExisting() : state.kind === 'ready' ? void onSubmit() : dispatch({ type: 'continue' })}>
              <Text style={[styles.buttonText, primaryDisabled && styles.disabledText]}>{primaryLabel}</Text>
            </Pressable>
            <View style={styles.secondaryActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Назад" disabled={submitting}
                accessibilityState={{ disabled: submitting }} style={[styles.secondaryButton, { flexBasis: 112 * fontScale }]}
                android_ripple={{ color: mapTheme.colors.border }} onPress={() => dispatch({ type: 'back' })}>
                <Text style={[styles.secondaryText, submitting && styles.disabledText]}>Назад</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Отмена" disabled={submitting}
                accessibilityState={{ disabled: submitting }} style={[styles.secondaryButton, { flexBasis: 112 * fontScale }]}
                android_ripple={{ color: mapTheme.colors.border }} onPress={() => dispatch({ type: 'cancel' })}>
                <Text style={[styles.secondaryText, submitting && styles.disabledText]}>Отмена</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', justifyContent: 'flex-end' },
  panel: { backgroundColor: mapTheme.colors.surface, borderRadius: mapTheme.radius.panel, maxHeight: '100%', ...mapTheme.shadow },
  scrollContent: { flexShrink: 1, borderRadius: mapTheme.radius.panel },
  panelContent: { padding: mapTheme.space.edge },
  title: { color: mapTheme.colors.text, fontSize: 22, fontWeight: '700' },
  message: { color: mapTheme.colors.secondaryText, fontSize: 14, marginTop: mapTheme.space.medium },
  options: { flexDirection: 'row', flexWrap: 'wrap', marginTop: mapTheme.space.edge, gap: mapTheme.space.large },
  option: {
    flexGrow: 1, flexShrink: 1, minHeight: 120, gap: mapTheme.space.large,
    alignItems: 'center', justifyContent: 'flex-start', padding: mapTheme.space.edge,
    borderRadius: mapTheme.radius.button, borderWidth: 2, borderColor: mapTheme.colors.border, overflow: 'hidden'
  },
  selectedOption: { borderColor: mapTheme.colors.primary, backgroundColor: mapTheme.colors.primarySurface },
  optionLabel: { color: mapTheme.colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center', alignSelf: 'stretch' },
  selectedText: { color: mapTheme.colors.primaryText },
  radio: {
    position: 'absolute', top: mapTheme.space.medium, right: mapTheme.space.medium,
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: mapTheme.colors.secondaryText,
    alignItems: 'center', justifyContent: 'center'
  },
  selectedRadio: { borderColor: mapTheme.colors.primaryText },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: mapTheme.colors.primaryText },
  summary: { flexDirection: 'row', alignItems: 'center', gap: mapTheme.space.large, marginTop: mapTheme.space.edge },
  summaryText: { flex: 1, gap: mapTheme.space.small },
  eventTitle: { color: mapTheme.colors.text, fontSize: 18, fontWeight: '700' },
  location: { color: mapTheme.colors.secondaryText, fontSize: 14 },
  errorPanel: { backgroundColor: mapTheme.colors.dangerSurface, borderRadius: mapTheme.radius.button, padding: mapTheme.space.large, marginTop: mapTheme.space.edge },
  error: { color: mapTheme.colors.danger, fontSize: 14 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: mapTheme.space.medium, marginTop: mapTheme.space.edge },
  progressText: { flex: 1, color: mapTheme.colors.secondaryText, fontSize: 14 },
  actions: { marginTop: mapTheme.space.edge, gap: mapTheme.space.medium },
  button: { minHeight: mapTheme.size.button, alignItems: 'center', justifyContent: 'center', padding: mapTheme.space.large, borderRadius: mapTheme.radius.button, backgroundColor: mapTheme.colors.primary, overflow: 'hidden' },
  // Large bold text preserves contrast on the approved blue primary surface.
  buttonText: { color: mapTheme.colors.surface, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: mapTheme.space.medium },
  secondaryButton: { flexGrow: 1, flexShrink: 1, minHeight: mapTheme.size.button, alignItems: 'center', justifyContent: 'center', padding: mapTheme.space.large, borderRadius: mapTheme.radius.button, backgroundColor: mapTheme.colors.mutedSurface, overflow: 'hidden' },
  secondaryText: { color: mapTheme.colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  disabled: { backgroundColor: mapTheme.colors.mutedSurface },
  disabledText: { color: mapTheme.colors.secondaryText }
});
