import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ROAD_EVENT_TYPES, type RoadEventType } from '../events/types';
import type { ReportLocationAction, ReportLocationState } from './report-location';

const TYPE_LABELS: Record<RoadEventType, string> = {
  road_check: 'Road check',
  accident: 'Accident',
  road_hazard: 'Road hazard',
  road_closure: 'Road closure'
};

interface Props {
  state: ReportLocationState;
  dispatch: (action: ReportLocationAction) => void;
  onSubmit: () => Promise<void>;
}

export function ReportLocationControls({ state, dispatch, onSubmit }: Props) {
  if (state.kind === 'idle') return null;
  const submitting = state.kind === 'submitting';
  const canContinue = (state.kind === 'choosing-type' && state.eventType !== null)
    || state.kind === 'ready';
  return (
    <View style={styles.container}>
        <View style={styles.panel}>
          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.panelContent}>
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {state.kind === 'ready' || state.kind === 'submitting'
              ? `Проверьте событие перед отправкой.\n${TYPE_LABELS[state.eventType]} (${state.eventType})\nШирота: ${state.coordinate.latitude}\nДолгота: ${state.coordinate.longitude}`
              : 'Выберите тип события. Удерживайте другую точку на карте, чтобы изменить место.'}
          </Text>
          {state.kind === 'ready' && state.error ? (
            <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text>
          ) : null}
          {state.kind === 'choosing-type' ? (
            <View accessibilityRole="radiogroup" style={styles.options}>
              {ROAD_EVENT_TYPES.map((eventType) => (
                <Pressable
                  key={eventType}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: state.eventType === eventType }}
                  style={[styles.option, state.eventType === eventType && styles.selectedOption]}
                  onPress={() => dispatch({ type: 'select-type', eventType })}
                >
                  <Text style={styles.message}>{state.eventType === eventType ? '●' : '○'} {TYPE_LABELS[eventType]}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          </ScrollView>
          <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={submitting} accessibilityState={{ disabled: submitting }} style={styles.cancel} onPress={() => dispatch({ type: 'back' })}>
                <Text style={styles.message}>Назад</Text>
              </Pressable>
            <Pressable accessibilityRole="button" disabled={submitting} accessibilityState={{ disabled: submitting }} style={styles.cancel} onPress={() => dispatch({ type: 'cancel' })}>
              <Text style={styles.message}>Отмена</Text>
            </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canContinue }}
                disabled={!canContinue}
                style={[styles.button, styles.primaryAction, !canContinue && styles.disabled]}
                onPress={() => state.kind === 'ready' ? void onSubmit() : dispatch({ type: 'continue' })}
              >
                <Text style={styles.buttonText}>{submitting ? 'Отправка…' : state.kind === 'choosing-type' ? 'Confirm' : 'Отправить'}</Text>
              </Pressable>
          </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 196, left: 16, right: 16, alignItems: 'flex-start' },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxHeight: 300 },
  scrollContent: { flexShrink: 1 },
  panelContent: { padding: 12 },
  options: { marginTop: 8, gap: 4 },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' },
  selectedOption: { borderColor: '#111827', backgroundColor: '#F3F4F6' },
  message: { color: '#111827', fontSize: 14 },
  error: { color: '#B91C1C', fontSize: 14, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, flexShrink: 0 },
  primaryAction: { width: '100%', alignItems: 'center' },
  button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: '#111827' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  cancel: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  disabled: { backgroundColor: '#6B7280' }
});
