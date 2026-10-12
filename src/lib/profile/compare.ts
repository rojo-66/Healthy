import type { Goal } from '../data/schemas/profile';
import { deltaTone, type DeltaTone } from './direction';
import { METRIC_KEYS, roundFor, type DerivedMetrics, type MetricKey, type MetricValue } from './metrics';

/** Una riga del confronto tra due misure. */
export interface CompareRow {
  key: MetricKey;
  now: MetricValue | null;
  before: MetricValue | null;
  /** Variazione arrotondata come viene mostrata; `null` se il parametro manca in una delle due misure. */
  delta: number | null;
  /** Variazione in % del valore precedente; `null` se non calcolabile. */
  deltaPct: number | null;
  tone: DeltaTone;
}

export type Comparison = Record<MetricKey, CompareRow>;

/** Due valori si confrontano se ci sono entrambi; il BMR stimato non si confronta mai con quello misurato. */
function comparable(key: MetricKey, now: MetricValue | null, before: MetricValue | null): boolean {
  if (!now || !before) return false;
  if (key === 'bmr') return now.origin === before.origin;
  return true;
}

/**
 * Confronto parametro per parametro (`before` = misura precedente, può mancare).
 * I parametri assenti in una delle due misure non hanno variazione: mai mostrati come zero.
 */
export function compareMetrics(now: DerivedMetrics, before: DerivedMetrics | null, goal: Goal | null): Comparison {
  const rows = {} as Comparison;
  for (const key of METRIC_KEYS) {
    const a = now[key];
    const b = before?.[key] ?? null;
    let delta: number | null = null;
    let deltaPct: number | null = null;
    let tone: DeltaTone = 'neutral';
    if (comparable(key, a, b)) {
      const after = roundFor(key, a!.value);
      const prev = roundFor(key, b!.value);
      delta = roundFor(key, after - prev);
      if (Object.is(delta, -0)) delta = 0;
      deltaPct = prev !== 0 ? ((after - prev) / prev) * 100 : null;
      // Il BMR stimato non è una misura: la sua variazione resta grigia.
      tone = key === 'bmr' && a!.origin === 'estimated' ? 'neutral' : deltaTone(key, goal, delta);
    }
    rows[key] = { key, now: a, before: b, delta, deltaPct, tone };
  }
  return rows;
}
