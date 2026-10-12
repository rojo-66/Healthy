import { addDays, fromIsoDate, weekStartOf } from '../diet/calc/calendar';
import { daysBetween } from '../profile/format';

/**
 * Periodi di Progressi (SPEC § 5.7), sempre su date locali `AAAA-MM-GG` e mai sui millisecondi:
 * così il cambio dell'ora legale (fine marzo, fine ottobre) non sposta i giorni.
 * Le settimane vanno da lunedì a domenica.
 * - "4 sett": le ultime 4 settimane, compresa quella in corso;
 * - "3 mesi": dal lunedì della settimana che contiene "oggi − 3 mesi di calendario";
 * - "Tutto": dal lunedì della settimana del primo dato.
 * L'inizio non va mai prima della settimana del primo dato (niente settimane vuote prima di cominciare).
 */

export type PeriodKey = '4w' | '3m' | 'all';

export const PERIODS: readonly { key: PeriodKey; label: string }[] = [
  { key: '4w', label: '4 sett' },
  { key: '3m', label: '3 mesi' },
  { key: 'all', label: 'Tutto' },
];

export interface DateRange {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Lunedì della settimana che contiene `iso`. */
export function mondayOf(iso: string): string {
  return weekStartOf(fromIsoDate(iso));
}

/** Somma mesi di calendario; il giorno resta, oppure diventa l'ultimo del mese (31/12 − 3 mesi → 30/09). */
export function addMonthsIso(iso: string, months: number): string {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`;
}

/** Intervallo del periodo fino a oggi; `null` se non c'è nessun dato. */
export function periodRange(key: PeriodKey, todayIso: string, firstIso: string | null): DateRange | null {
  if (firstIso === null) return null;
  const firstMonday = mondayOf(firstIso < todayIso ? firstIso : todayIso);
  const start =
    key === '4w' ? addDays(mondayOf(todayIso), -21) : key === '3m' ? mondayOf(addMonthsIso(todayIso, -3)) : firstMonday;
  return { from: start > firstMonday ? start : firstMonday, to: todayIso };
}

export function inRange(date: string, range: DateRange | null): boolean {
  return range !== null && date >= range.from && date <= range.to;
}

/** Lunedì di ogni settimana tra le due date, comprese. */
export function weeksBetween(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const last = mondayOf(toIso);
  for (let monday = mondayOf(fromIso); monday <= last; monday = addDays(monday, 7)) out.push(monday);
  return out;
}

export interface DataSpan {
  first: string;
  weeks: number;
}

/** Prima data tra quelle dei dati e settimane passate da allora (almeno 1). */
export function dataSpan(dates: Iterable<string>, todayIso: string): DataSpan | null {
  let first: string | null = null;
  for (const date of dates) if (first === null || date < first) first = date;
  if (first === null) return null;
  return { first, weeks: Math.max(1, Math.floor(daysBetween(first, todayIso) / 7)) };
}
