import { buildCalendar, type CalendarInput, type Occurrence } from '../../calendar/occurrences';
import { addDays, fromIsoDate, isoWeekday, weekStartOf } from '../../diet/calc/calendar';
import type { Run } from '../../data/schemas/runs';
import type { Workout } from '../../data/schemas/workouts';
import { runTag } from '../../runs/format';

/**
 * Stato di un giorno nella striscia Settimana (2c: dalle occorrenze, dopo spostamenti e salti):
 * `done` tutte le attività fatte · `partial` alcune sì e altre no · `next` prossimo allenamento · `todo` in programma ·
 * `missed` passato senza niente di fatto (NON FATTO) · `skipped` solo attività saltate · `rest` niente (riposo).
 */
export type DayState = 'done' | 'partial' | 'next' | 'todo' | 'missed' | 'skipped' | 'rest';

export interface WeekDay {
  /** 1 = lunedì … 7 = domenica. */
  weekday: number;
  /** `AAAA-MM-GG` locale. */
  date: string;
  /** Attività del giorno (anche saltate), schede prima e poi corse, per nome. */
  occurrences: Occurrence[];
  /** Schede del giorno (non saltate), in ordine di nome. */
  workouts: Workout[];
  /** Corse del giorno (non saltate), in ordine di nome. */
  runs: Run[];
  /** Sigla della prima attività (PET, GAM… o della corsa); `—` nei giorni di riposo. */
  tag: string;
  /** Di chi è la sigla: scheda (magenta) o corsa (ciano). */
  tagKind: 'workout' | 'run' | null;
  /** C'è un'attività spostata qui da un altro giorno. */
  movedIn: boolean;
  state: DayState;
  isToday: boolean;
}

export interface NextWorkout {
  workout: Workout;
  date: string;
  weekday: number;
  /** Giorni da oggi (0 = oggi, 1 = domani…). */
  inDays: number;
}

export interface WeekPlan {
  days: WeekDay[];
  next: NextWorkout | null;
}

/** Sigla di una scheda: prime 3 lettere o cifre del nome, senza accenti, in maiuscolo ("Petto + Schiena" → "PET"). */
export function workoutTag(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');
  return clean.slice(0, 3).toUpperCase() || '—';
}

const byName = (a: Workout, b: Workout) => a.name.localeCompare(b.name, 'it');

/** Schede assegnate a un giorno della settimana. */
export function workoutsOn(workouts: readonly Workout[], weekday: number): Workout[] {
  return workouts.filter((w) => w.weekdays.includes(weekday)).sort(byName);
}

/** Corse previste in un giorno della settimana (2a). */
export function runsOn(runs: readonly Run[], weekday: number): Run[] {
  return runs.filter((r) => r.weekdays.includes(weekday)).sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

/** Sigla di un'attività. */
export function occurrenceTag(o: Pick<Occurrence, 'kind' | 'name'>): string {
  return o.kind === 'run' ? runTag(o) : workoutTag(o.name);
}

const isDone = (o: Occurrence) => o.status === 'done';

/** Stato di un giorno dalle sue attività (senza "prossimo", che si decide sulla settimana). */
export function dayState(occurrences: readonly Occurrence[], date: string, todayIso: string): Exclude<DayState, 'next'> {
  const active = occurrences.filter((o) => !o.skipped);
  if (active.length === 0) return occurrences.length > 0 ? 'skipped' : 'rest';
  const done = active.filter(isDone).length;
  if (done === active.length) return 'done';
  if (done > 0) return 'partial';
  return date < todayIso ? 'missed' : 'todo';
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromIsoDate(toIso).getTime() - fromIsoDate(fromIso).getTime()) / 86_400_000);
}

/**
 * Settimana corrente (lunedì–domenica di oggi) dalle occorrenze, e prossimo allenamento: la prima scheda da fare da
 * oggi in poi (anche spostata), cercata anche nella settimana dopo. Le corse contano come attività del giorno ma il
 * "prossimo" resta un allenamento con una scheda (la card "Prossimo" lo avvia).
 */
export function weekPlan(input: CalendarInput): WeekPlan {
  const todayIso = input.todayIso;
  const start = weekStartOf(fromIsoDate(todayIso));
  const { occurrences } = buildCalendar(start, addDays(start, 13), input);

  const pending = occurrences
    .filter((o) => o.kind === 'workout' && o.workout && o.status === 'todo' && o.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'it'));
  const first = pending[0];
  const next: NextWorkout | null =
    first && first.workout
      ? { workout: first.workout, date: first.date, weekday: isoWeekday(fromIsoDate(first.date)), inDays: daysBetween(todayIso, first.date) }
      : null;

  const days: WeekDay[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const date = addDays(start, weekday - 1);
    const ofDay = occurrences
      .filter((o) => o.date === date)
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'it') : a.kind === 'workout' ? -1 : 1));
    const shown = ofDay.filter((o) => !o.skipped);
    const lead = shown[0] ?? ofDay[0];
    const base = dayState(ofDay, date, todayIso);
    days.push({
      weekday,
      date,
      occurrences: ofDay,
      workouts: shown.flatMap((o) => (o.workout ? [o.workout] : [])),
      runs: shown.flatMap((o) => (o.run ? [o.run] : [])),
      tag: lead ? occurrenceTag(lead) : '—',
      tagKind: lead ? lead.kind : null,
      movedIn: ofDay.some((o) => o.moved && !o.skipped),
      state: base === 'todo' && next?.date === date ? 'next' : base,
      isToday: date === todayIso,
    });
  }
  return { days, next };
}

/** Giorno della settimana di una data locale `AAAA-MM-GG` (1 = lunedì). */
export function weekdayOf(iso: string): number {
  return isoWeekday(fromIsoDate(iso));
}
