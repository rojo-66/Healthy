import type { Session } from '../data/schemas/sessions';
import { addDays, fromIsoDate, isoWeekday, toIsoDate } from '../diet/calc/calendar';

/**
 * Calendario del mese nello Storico. `gym` = almeno una sessione conclusa quel giorno (magenta),
 * `run` = almeno una corsa fatta (ciano, 2a), `both` = tutte e due, `rest` = giorno passato senza attività (grigio),
 * `future` = non ancora arrivato.
 */
export type CalendarKind = 'gym' | 'run' | 'both' | 'rest' | 'future';

export interface CalendarCell {
  /** `null` per le caselle vuote prima del primo giorno (il mese parte di lunedì). */
  date: string | null;
  day: number;
  kind: CalendarKind;
  isToday: boolean;
  sessions: number;
  /** Corse fatte quel giorno (2a). */
  runs: number;
}

export interface MonthRef {
  year: number;
  /** 0 = gennaio. */
  month: number;
}

type Dated = Pick<Session, 'startedAt' | 'endedAt'>;

/** Giorno locale di una sessione. */
export function sessionDate(s: Pick<Session, 'startedAt'>): string {
  return toIsoDate(new Date(s.startedAt));
}

export function monthOf(date: Date): MonthRef {
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addMonths({ year, month }: MonthRef, delta: number): MonthRef {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function compareMonths(a: MonthRef, b: MonthRef): number {
  return a.year - b.year || a.month - b.month;
}

/** Il mese contiene il giorno (`AAAA-MM-GG`)? */
export function inMonth(date: string, { year, month }: MonthRef): boolean {
  const d = fromIsoDate(date);
  return d.getFullYear() === year && d.getMonth() === month;
}

/** `runDates`: giorni (`AAAA-MM-GG`) delle corse fatte, uno per corsa. */
export function monthGrid(ref: MonthRef, sessions: readonly Dated[], today: Date, runDates: readonly string[] = []): CalendarCell[] {
  const todayIso = toIsoDate(today);
  const perDay = new Map<string, number>();
  for (const s of sessions) {
    if (s.endedAt === null) continue;
    const date = sessionDate(s);
    perDay.set(date, (perDay.get(date) ?? 0) + 1);
  }
  const runsPerDay = new Map<string, number>();
  for (const date of runDates) runsPerDay.set(date, (runsPerDay.get(date) ?? 0) + 1);
  const first = toIsoDate(new Date(ref.year, ref.month, 1));
  const cells: CalendarCell[] = [];
  for (let i = 1; i < isoWeekday(fromIsoDate(first)); i++) {
    cells.push({ date: null, day: 0, kind: 'future', isToday: false, sessions: 0, runs: 0 });
  }
  for (let date = first; inMonth(date, ref); date = addDays(date, 1)) {
    const count = perDay.get(date) ?? 0;
    const runs = runsPerDay.get(date) ?? 0;
    cells.push({
      date,
      day: fromIsoDate(date).getDate(),
      kind: count > 0 && runs > 0 ? 'both' : count > 0 ? 'gym' : runs > 0 ? 'run' : date <= todayIso ? 'rest' : 'future',
      isToday: date === todayIso,
      sessions: count,
      runs,
    });
  }
  return cells;
}

/** Sessioni concluse del mese, dalla più recente. */
export function sessionsInMonth<T extends Dated>(sessions: readonly T[], ref: MonthRef): T[] {
  return sessions
    .filter((s) => s.endedAt !== null && inMonth(sessionDate(s), ref))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** "9 sessioni · 2 PR" del mese. */
export function monthSummary<T extends Dated & { id: string }>(
  sessions: readonly T[],
  ref: MonthRef,
  records: ReadonlyMap<string, number>,
): { sessions: number; records: number } {
  const list = sessionsInMonth(sessions, ref);
  return { sessions: list.length, records: list.reduce((sum, s) => sum + (records.get(s.id) ?? 0), 0) };
}
