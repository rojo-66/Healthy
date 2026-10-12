import type { Measurement } from '../data/schemas/measurements';
import type { Goal } from '../data/schemas/profile';
import { deltaTone, type DeltaTone } from '../profile/direction';
import { CIRCUMFERENCES, deriveMetrics, roundFor, type MetricKey, type Origin, type ProfileForMetrics } from '../profile/metrics';
import { deltaText, metricWithUnit } from '../profile/format';
import { pointDate, spansYears } from './format';
import type { Point } from './series';

/**
 * Tab Corpo (SPEC § 5.7): serie di peso, composizione e circonferenze dalle misure del Profilo.
 * I valori sono quelli della logica M7 (`deriveMetrics`): misurati o calcolati dalla stessa misura.
 * Una misura senza quel valore non entra nella serie (mai zero).
 */

export const COMPOSITION_KEYS = ['ffmKg', 'fmKg', 'bcmKg', 'pha', 'tbw', 'ecwTbw'] as const satisfies readonly MetricKey[];
export const CIRCUMFERENCE_KEYS = CIRCUMFERENCES.map(([key]) => key);

export type BodyKey = 'weight' | (typeof COMPOSITION_KEYS)[number] | (typeof CIRCUMFERENCE_KEYS)[number];
export const BODY_KEYS: readonly BodyKey[] = ['weight', ...COMPOSITION_KEYS, ...CIRCUMFERENCE_KEYS];

/** Etichette brevi dei piccoli grafici (mockup): stanno su una riga anche a 375 px. */
export const COMPOSITION_LABELS: Readonly<Record<(typeof COMPOSITION_KEYS)[number], string>> = {
  ffmKg: 'MASSA MAGRA FFM',
  fmKg: 'MASSA GRASSA FM',
  bcmKg: 'CELLULARE BCM',
  pha: 'ANGOLO DI FASE',
  tbw: 'ACQUA TOTALE TBW',
  ecwTbw: 'ECW / TBW',
};

export interface BodyPoint extends Point {
  origin: Origin;
}

export type BodySeries = Record<BodyKey, BodyPoint[]>;

/** Serie di tutti i parametri della tab Corpo, dalla misura più vecchia. */
export function bodySeries(measurements: readonly Measurement[], profile: ProfileForMetrics | undefined): BodySeries {
  const out = Object.fromEntries(BODY_KEYS.map((key) => [key, [] as BodyPoint[]])) as BodySeries;
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  for (const m of sorted) {
    const metrics = deriveMetrics(m, profile);
    for (const key of BODY_KEYS) {
      const metric = metrics[key];
      if (metric) out[key].push({ date: m.date, value: metric.value, origin: metric.origin });
    }
  }
  return out;
}

export interface BodyChange {
  /** Ultimo valore del periodo. */
  now: number | null;
  /** Ultimo meno primo, arrotondati come a video; `null` con meno di 2 punti. */
  delta: number | null;
  tone: DeltaTone;
}

/** Valore attuale e variazione nel periodo, con il colore per obiettivo della tabella M7. */
export function bodyChange(key: BodyKey, points: readonly Point[], goal: Goal | null): BodyChange {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return { now: null, delta: null, tone: 'neutral' };
  if (points.length < 2) return { now: last.value, delta: null, tone: 'neutral' };
  const delta = roundFor(key, last.value) - roundFor(key, first.value);
  const clean = roundFor(key, delta) || 0; // niente −0 né 0,30000000000000004
  return { now: last.value, delta: clean, tone: deltaTone(key, goal, clean) };
}

export interface BodyTableRow {
  key: string;
  cells: [date: string, value: string, delta: string];
}

/**
 * Righe della vista Tabella (dalla più recente): data, valore con unità ("calc." se calcolato dalla
 * stessa misura) e variazione rispetto alla misura prima.
 */
export function bodyTableRows(key: BodyKey, points: readonly BodyPoint[]): BodyTableRow[] {
  const multiYear = spansYears(points.map((p) => p.date));
  return points
    .map((p, i): BodyTableRow => {
      const prev = points[i - 1];
      const delta = prev ? roundFor(key, roundFor(key, p.value) - roundFor(key, prev.value)) || 0 : null;
      return {
        key: p.date,
        cells: [
          pointDate(p.date, multiYear),
          metricWithUnit(key, p.value) + (p.origin === 'measured' ? '' : ' calc.'),
          delta === null ? 'prima' : deltaText(key, delta),
        ],
      };
    })
    .reverse();
}

/**
 * Data della prossima misura (inserita nel Profilo, `settings.nextMeasurement`): vale solo se è dopo
 * l'ultima misura del grafico e non è già passata (scelta confermata in M9).
 */
export function nextMeasurementDate(next: { date: string | null } | null | undefined, lastDate: string | null, todayIso: string): string | null {
  const date = next?.date ?? null;
  if (date === null || date < todayIso) return null;
  if (lastDate !== null && date <= lastDate) return null;
  return date;
}
