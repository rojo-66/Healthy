import type { ReadinessDraft } from './readiness';

/**
 * Bozza del flusso prima di "Inizia allenamento" (Readiness e riscaldamento): resta in memoria.
 * La sessione nel database nasce solo al tocco su "Inizia"; se l'app viene chiusa prima, si rifà il Readiness.
 */
export const flow = $state<{ workoutId: string | null; readiness: ReadinessDraft; warmup: boolean[] }>({
  workoutId: null,
  readiness: {},
  warmup: [],
});

/** Riparte da zero se cambia la scheda. */
export function beginFlow(workoutId: string): void {
  if (flow.workoutId === workoutId) return;
  flow.workoutId = workoutId;
  flow.readiness = {};
  flow.warmup = [];
}

export function clearFlow(): void {
  flow.workoutId = null;
  flow.readiness = {};
  flow.warmup = [];
}
