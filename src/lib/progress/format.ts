import { weekdayName } from '../data/schemas/diet-payload';
import { dayMonthYear, fromIsoDate, isoWeekday, MONTHS, shortDate } from '../diet/calc/calendar';
import { formatDecimal, formatInt } from '../diet/format';
import { dayMonth, numericDate } from '../profile/format';
import type { DataSpan } from './period';
import type { Point } from './series';

/** Testi di Progressi: virgola decimale, punto delle migliaia, segno meno tipografico, date gg/mm. */

/** "DAL 21 AGO 2026 · 7 SETTIMANE DI DATI" (sotto il titolo). */
export function spanLine(span: DataSpan | null): string {
  if (!span) return 'NESSUN DATO ANCORA';
  const weeks = span.weeks === 1 ? '1 SETTIMANA' : `${span.weeks} SETTIMANE`;
  return `DAL ${dayMonthYear(fromIsoDate(span.first))} · ${weeks} DI DATI`;
}

/** Data di un punto: "02/10"; "02/10/2025" se la serie copre più anni (gg/mm sarebbe ambiguo). */
export function pointDate(iso: string, multiYear: boolean): string {
  return multiYear ? numericDate(iso) : dayMonth(iso);
}

/** La serie copre più di un anno di calendario? */
export function spansYears(dates: readonly string[]): boolean {
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first !== undefined && last !== undefined && first.slice(0, 4) !== last.slice(0, 4);
}

/** "12 ott". */
export function shortDay(iso: string): string {
  return shortDate(fromIsoDate(iso));
}

/** Tonnellate con un decimale: 5400 kg → "5,4 t". */
export function tonnes(kg: number): string {
  return `${formatDecimal(kg / 1000, 1)} t`;
}

/** Percentuale intera con il segno: "+3 %", "−8 %", "0 %". */
export function signedPct(pct: number): string {
  const n = Math.round(pct);
  return `${n > 0 ? '+' : ''}${formatInt(n)} %`;
}

/** Freccia di una variazione: ▲ aumento, ▼ calo, ■ nessun cambio. */
export function arrow(delta: number): string {
  return delta > 0 ? '▲' : delta < 0 ? '▼' : '■';
}

/**
 * Frase che riassume un grafico per lo screen reader:
 * "Peso: da 87,5 a 88,9 kg dal 21/08 al 02/10", "Peso: 88,9 kg il 02/10, una sola misura", "Peso: nessun dato".
 */
export function chartSummary(label: string, points: readonly Point[], value: (v: number) => string, unit = ''): string {
  const first = points[0];
  const last = points[points.length - 1];
  const u = unit ? ` ${unit}` : '';
  if (!first || !last) return `${label}: nessun dato`;
  if (points.length === 1) return `${label}: ${value(last.value)}${u} il ${dayMonth(last.date)}, un solo valore`;
  return `${label}: da ${value(first.value)} a ${value(last.value)}${u} dal ${dayMonth(first.date)} al ${dayMonth(last.date)}`;
}

/** "gio 1 ott" (tooltip dello scarto dal target). */
export function weekdayDay(iso: string): string {
  const date = fromIsoDate(iso);
  return `${weekdayName(isoWeekday(date)).slice(0, 3).toLowerCase()} ${shortDate(date)}`;
}

/** "1 ottobre" (inizio del piano). */
export function longDay(iso: string): string {
  const date = fromIsoDate(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]?.toLowerCase() ?? ''}`;
}
