import { daysBetween } from '../profile/format';
import { inRange, type DateRange } from './period';

/**
 * Serie nel tempo: un punto per misura o sessione, ordinati per data. I valori mancanti non diventano
 * zero: la serie salta quel punto. Oltre {@link MANY_POINTS} punti i pallini si mostrano solo sul punto
 * selezionato, sul minimo e sul massimo (nessuna aggregazione, scelta confermata in M9).
 */

export interface Point {
  /** Giorno locale `AAAA-MM-GG`. */
  date: string;
  value: number;
}

export const MANY_POINTS = 120;

/** Punti dentro l'intervallo (tutti se `range` è `undefined`). */
export function pointsIn<T extends Point>(points: readonly T[], range: DateRange | null | undefined): T[] {
  if (range === undefined) return [...points];
  return points.filter((p) => inRange(p.date, range));
}

/** Variazione tra primo e ultimo punto; `null` con meno di 2 punti. */
export function seriesDelta(points: readonly Point[]): number | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  return last.value - first.value;
}

/** Indici del valore minimo e massimo (il primo a parità). */
export function extremes(points: readonly Point[]): { min: number; max: number } | null {
  if (points.length === 0) return null;
  let min = 0;
  let max = 0;
  points.forEach((p, i) => {
    if (p.value < (points[min]?.value ?? Infinity)) min = i;
    if (p.value > (points[max]?.value ?? -Infinity)) max = i;
  });
  return { min, max };
}

/** Punti che mostrano il pallino: tutti, oppure (serie lunghe) selezionato, minimo e massimo. */
export function markerIndexes(points: readonly Point[], selected: number): Set<number> {
  if (points.length <= MANY_POINTS) return new Set(points.map((_, i) => i));
  const ext = extremes(points);
  const out = new Set<number>([selected]);
  if (ext) {
    out.add(ext.min);
    out.add(ext.max);
  }
  return out;
}

/**
 * Posizione di ogni data tra 0 e 1, proporzionale al tempo (le pause si vedono).
 * `until` allunga l'asse oltre l'ultima data (es. la prossima misura). Con una data sola: 0,5.
 */
export function timeFractions(dates: readonly string[], until?: string | null): number[] {
  const first = dates[0];
  if (first === undefined) return [];
  const lastDate = until && until > (dates[dates.length - 1] ?? first) ? until : dates[dates.length - 1] ?? first;
  const span = daysBetween(first, lastDate);
  if (span <= 0) return dates.map(() => 0.5);
  return dates.map((d) => daysBetween(first, d) / span);
}
