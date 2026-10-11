/**
 * Date della Dieta, sempre nell'ora locale del telefono (convenzione M2: giorni `AAAA-MM-GG` locali).
 * Giorni della settimana 1 = lunedì … 7 = domenica.
 */

const pad = (n: number) => String(n).padStart(2, '0');

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const;
export const MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
] as const;
const WEEKDAYS_SHORT = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'] as const;
/** Iniziali per la striscia dei giorni. */
export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const;

/** Data locale → `AAAA-MM-GG`. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `AAAA-MM-GG` → mezzanotte locale. */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Giorno della settimana, 1 = lunedì … 7 = domenica. */
export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Lunedì della settimana che contiene `date`. */
export function weekStartOf(date: Date): string {
  return addDays(toIsoDate(date), 1 - isoWeekday(date));
}

/** Etichetta della settimana: "12–18 ott", oppure "28 set – 4 ott" se cambia il mese. */
export function weekRangeLabel(weekStart: string): string {
  const start = fromIsoDate(weekStart);
  const end = fromIsoDate(addDays(weekStart, 6));
  const startMonth = MONTHS_SHORT[start.getMonth()];
  const endMonth = MONTHS_SHORT[end.getMonth()];
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${end.getDate()} ${endMonth}`;
  return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
}

/** "LUN 12 OTT 2026" (intestazione della schermata). */
export function headerDate(date: Date): string {
  const month = MONTHS_SHORT[date.getMonth()]?.toUpperCase() ?? '';
  return `${WEEKDAYS_SHORT[isoWeekday(date) - 1]} ${date.getDate()} ${month} ${date.getFullYear()}`;
}

/** "12 OTT 2026" (riga in alto della Home). */
export function dayMonthYear(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]?.toUpperCase() ?? ''} ${date.getFullYear()}`;
}

/** "11 ott" (es. "importato l'11 ott"). */
export function shortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** Minuti dalla mezzanotte. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Giorno del piano da seguire: quello del calendario, oppure quello scelto con
 * "Oggi seguo il piano di un altro giorno" (`swappedFromWeekday` nel diario).
 */
export function effectiveWeekday(calendarWeekday: number, swappedFromWeekday: number | null | undefined): number {
  return swappedFromWeekday ?? calendarWeekday;
}
