import { occurrenceKey, type ActivityKind, type CalendarEdit } from '../data/schemas/calendar';
import type { Run, RunLog } from '../data/schemas/runs';
import type { Session } from '../data/schemas/sessions';
import type { Workout } from '../data/schemas/workouts';
import { addDays, fromIsoDate, isoWeekday, weekStartOf } from '../diet/calc/calendar';
import { sessionDate } from '../sessions/calendar';

/**
 * Occorrenze delle attività (2c): un'attività (scheda o corsa) in una data. Si calcolano, non si salvano:
 * ricorrenza settimanale (`weekdays`) + eccezioni della data (`calendarEdits`: spostata o saltata).
 * Una sessione (o una corsa fatta) completa l'occorrenza della stessa attività nello stesso giorno effettivo;
 * altrimenti è "fuori programma" e l'occorrenza resta da fare (decisione 2c).
 */

/**
 * `todo` da fare (oggi o dopo) · `missed` passata e non fatta · `in-progress` sessione in corso ·
 * `done` fatta quel giorno · `skipped` saltata (conta come non fatta).
 */
export type OccurrenceStatus = 'todo' | 'missed' | 'in-progress' | 'done' | 'skipped';

export interface Occurrence {
  /** `workout:<id>:<data originale>`. */
  key: string;
  kind: ActivityKind;
  refId: string;
  name: string;
  /** Data nella ricorrenza settimanale. */
  originalDate: string;
  /** Giorno effettivo (dopo lo spostamento). */
  date: string;
  moved: boolean;
  skipped: boolean;
  status: OccurrenceStatus;
  /** Sessione che la completa (o in corso). */
  session: Session | null;
  /** Corsa fatta che la completa. */
  log: RunLog | null;
  workout: Workout | null;
  run: Run | null;
}

export interface CalendarInput {
  workouts: readonly Workout[];
  runs: readonly Run[];
  edits: readonly CalendarEdit[];
  /** Sessioni (si usano quelle concluse del periodo). */
  sessions: readonly Session[];
  runLogs: readonly RunLog[];
  /** Sessione in corso, se c'è. */
  active?: Session | null;
  todayIso: string;
}

export interface CalendarDays {
  occurrences: Occurrence[];
  /** Sessioni concluse senza un'occorrenza della stessa scheda quel giorno ("fuori programma"). */
  extraSessions: Session[];
  /** Corse fatte senza un'occorrenza della stessa corsa quel giorno ("fuori programma"). */
  extraLogs: RunLog[];
}

export interface CalendarWindow {
  /** Lunedì della settimana scorsa. */
  from: string;
  /** Domenica della settimana prossima. */
  to: string;
  /** I tre lunedì: settimana scorsa, questa, prossima. */
  weeks: [string, string, string];
}

/** Finestra degli spostamenti e del calendario: settimana scorsa, questa e prossima. */
export function calendarWindow(todayIso: string): CalendarWindow {
  const monday = weekStartOf(fromIsoDate(todayIso));
  const prev = addDays(monday, -7);
  return { from: prev, to: addDays(monday, 13), weeks: [prev, monday, addDays(monday, 7)] };
}

export function inWindow(date: string, window: Pick<CalendarWindow, 'from' | 'to'>): boolean {
  return date >= window.from && date <= window.to;
}

export function weekdayOfIso(iso: string): number {
  return isoWeekday(fromIsoDate(iso));
}

/** Date da `from` a `to` comprese. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) out.push(date);
  return out;
}

interface Activity {
  kind: ActivityKind;
  refId: string;
  name: string;
  weekdays: readonly number[];
  workout: Workout | null;
  run: Run | null;
}

const KIND_ORDER: Record<ActivityKind, number> = { workout: 0, run: 1 };

/** Ordine nel giorno: prima le schede, poi le corse, ciascuna per nome (come Allena e la Home). */
export function compareOccurrences(a: Pick<Occurrence, 'kind' | 'name'>, b: Pick<Occurrence, 'kind' | 'name'>): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name, 'it');
}

function activities(workouts: readonly Workout[], runs: readonly Run[]): Map<string, Activity> {
  const map = new Map<string, Activity>();
  for (const w of workouts) map.set(`workout:${w.id}`, { kind: 'workout', refId: w.id, name: w.name, weekdays: w.weekdays, workout: w, run: null });
  for (const r of runs) map.set(`run:${r.id}`, { kind: 'run', refId: r.id, name: r.name, weekdays: r.weekdays, workout: null, run: r });
  return map;
}

/**
 * Un'eccezione vale solo se la sua occorrenza esiste ancora nella ricorrenza (la scheda c'è e quel giorno della
 * settimana è ancora suo). Le altre (scheda eliminata, giorni cambiati nell'Editor) si ignorano.
 */
function editApplies(edit: CalendarEdit, list: Map<string, Activity>): boolean {
  const activity = list.get(`${edit.kind}:${edit.refId}`);
  return activity !== undefined && activity.weekdays.includes(weekdayOfIso(edit.originalDate));
}

/**
 * Occorrenze con il giorno effettivo tra `from` e `to` (compresi), con lo stato; più le attività fatte fuori programma
 * nello stesso periodo. Le occorrenze spostate dentro il periodo da fuori ci sono; quelle spostate fuori no.
 */
export function buildCalendar(from: string, to: string, input: CalendarInput): CalendarDays {
  const list = activities(input.workouts, input.runs);
  const edits = new Map<string, CalendarEdit>();
  for (const edit of input.edits) if (editApplies(edit, list)) edits.set(edit.key, edit);

  // Date originali: quelle del periodo, più quelle spostate dentro il periodo da fuori.
  const originals: { activity: Activity; date: string }[] = [];
  for (const date of datesBetween(from, to)) {
    const weekday = weekdayOfIso(date);
    for (const activity of list.values()) if (activity.weekdays.includes(weekday)) originals.push({ activity, date });
  }
  for (const edit of edits.values()) {
    if (edit.toDate === null) continue;
    if (edit.originalDate >= from && edit.originalDate <= to) continue;
    if (edit.toDate < from || edit.toDate > to) continue;
    originals.push({ activity: list.get(`${edit.kind}:${edit.refId}`)!, date: edit.originalDate });
  }

  const placed = originals
    .map(({ activity, date }) => {
      const key = occurrenceKey(activity.kind, activity.refId, date);
      const edit = edits.get(key);
      const effective = edit?.toDate ?? date;
      return { activity, key, originalDate: date, date: effective, skipped: edit?.action === 'skip' };
    })
    .filter((o) => o.date >= from && o.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.originalDate.localeCompare(b.originalDate));

  // Sessioni e corse fatte del periodo, per giorno e attività: ognuna completa al massimo un'occorrenza.
  const sessionsBy = new Map<string, Session[]>();
  for (const s of input.sessions) {
    if (s.endedAt === null) continue;
    const date = sessionDate(s);
    if (date < from || date > to) continue;
    const id = `${date}|${s.workoutId}`;
    sessionsBy.set(id, [...(sessionsBy.get(id) ?? []), s]);
  }
  for (const group of sessionsBy.values()) group.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const logsBy = new Map<string, RunLog[]>();
  for (const log of input.runLogs) {
    if (log.date < from || log.date > to || log.runId === null) continue;
    const id = `${log.date}|${log.runId}`;
    logsBy.set(id, [...(logsBy.get(id) ?? []), log]);
  }
  for (const group of logsBy.values()) group.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

  const usedSessions = new Set<Session>();
  const usedLogs = new Set<RunLog>();
  const active = input.active ?? null;
  let activeUsed = false;

  const occurrences = placed.map(({ activity, key, originalDate, date, skipped }): Occurrence => {
    let session: Session | null = null;
    let log: RunLog | null = null;
    let status: OccurrenceStatus;
    if (skipped) status = 'skipped';
    else if (activity.kind === 'workout') {
      const done = (sessionsBy.get(`${date}|${activity.refId}`) ?? []).filter((s) => !usedSessions.has(s));
      // L'ultima della giornata (come prima del 2c: la Home mostrava l'ultima sessione conclusa).
      session = done.at(-1) ?? null;
      if (session) usedSessions.add(session);
      if (!session && !activeUsed && active && active.workoutId === activity.refId && sessionDate(active) === date) {
        session = active;
        activeUsed = true;
      }
      status = session ? (session.endedAt === null ? 'in-progress' : 'done') : date < input.todayIso ? 'missed' : 'todo';
    } else {
      const done = (logsBy.get(`${date}|${activity.refId}`) ?? []).filter((l) => !usedLogs.has(l));
      log = done.at(-1) ?? null;
      if (log) usedLogs.add(log);
      status = log ? 'done' : date < input.todayIso ? 'missed' : 'todo';
    }
    return {
      key,
      kind: activity.kind,
      refId: activity.refId,
      name: activity.name,
      originalDate,
      date,
      moved: date !== originalDate,
      skipped,
      status,
      session,
      log,
      workout: activity.workout,
      run: activity.run,
    };
  });

  // Con più sessioni della stessa scheda nello stesso giorno, le altre sono fuori programma.
  const extraSessions = [...sessionsBy.values()]
    .flat()
    .filter((s) => !usedSessions.has(s))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const extraLogs = input.runLogs
    .filter((l) => l.date >= from && l.date <= to && !usedLogs.has(l))
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  return { occurrences, extraSessions, extraLogs };
}

/** Occorrenze di un giorno, nell'ordine di Allena (schede, poi corse, per nome). */
export function occurrencesOn(occurrences: readonly Occurrence[], date: string): Occurrence[] {
  return occurrences.filter((o) => o.date === date).sort(compareOccurrences);
}

/** Si può spostare o saltare: non fatta, non in corso, nella finestra (anche passata: recupero). */
export function canReschedule(o: Occurrence, window: Pick<CalendarWindow, 'from' | 'to'>): boolean {
  return (o.status === 'todo' || o.status === 'missed') && inWindow(o.date, window);
}

/** Attività che contano per il tipo di giornata: occorrenze non saltate + attività fatte fuori programma. */
export function dayActivities(
  days: CalendarDays,
  date: string,
  active: Session | null = null,
): { gym: boolean; run: boolean } {
  const ofDay = days.occurrences.filter((o) => o.date === date && !o.skipped);
  const extraGym =
    days.extraSessions.some((s) => sessionDate(s) === date) ||
    (active !== null && sessionDate(active) === date && !ofDay.some((o) => o.session?.id === active.id));
  return {
    gym: ofDay.some((o) => o.kind === 'workout') || extraGym,
    run: ofDay.some((o) => o.kind === 'run') || days.extraLogs.some((l) => l.date === date),
  };
}
