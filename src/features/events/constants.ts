export interface EventLifecycleConfig {
  initialConfidence: number;
  confirmationConfidenceDelta: number;
  goneConfidenceDelta: number;
  staleAfterMs: number;
  expiryTtlMs: number;
  removalThreshold: number;
  duplicateRadiusMeters: number;
}

export const EVENT_LIFECYCLE: EventLifecycleConfig = {
  initialConfidence: 0,
  confirmationConfidenceDelta: 1,
  goneConfidenceDelta: -1,
  staleAfterMs: 30 * 60 * 1000,
  expiryTtlMs: 4 * 60 * 60 * 1000,
  removalThreshold: -3,
  duplicateRadiusMeters: 150
};
