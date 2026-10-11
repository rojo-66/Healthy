import { addDays, fromIsoDate, isoWeekday, toIsoDate, weekStartOf } from '../../diet/calc/calendar';
import type { Session } from '../../data/schemas/sessions';
import type { Workout } from '../../data/schemas/workouts';

/**
 * Stato di un giorno nella striscia Settimana:
 * `done` sessione conclusa · `next` prossimo allenamento · `todo` in programma ·
 * `missed` passato senza sessione (NON FATTO) · `rest` nessuna scheda (riposo).
 */
export type DayState = 'done' | 'next' | 'todo' | 'missed' | 'rest';

export interface WeekDay {
  /** 1 = lunedì … 7 = domenica. */
  weekday: number;
  /** `AAAA-MM-GG` locale. */
  date: string;
  /** Schede assegnate, in ordine di nome. */
  workouts: Workout[];
  /** Sigla della prima scheda (PET, GAM…), `—` nei giorni di riposo. */
  tag: string;
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

/** Data locale di inizio di una sessione. */
function sessionDate(s: Pick<Session, 'startedAt'>): string {
  return toIsoDate(new Date(s.startedAt));
}

/**
 * Settimana corrente (lunedì–domenica di `today`) e prossimo allenamento.
 * "Prossimo" = primo giorno da oggi in poi con una scheda e senza sessione conclusa in quella data;
 * se la settimana è finita, il primo giorno con una scheda della settimana dopo.
 * Funziona anche senza sessioni (fino al M5 la lista è vuota).
 */
export function weekPlan(
  workouts: readonly Workout[],
  sessions: readonly Pick<Session, 'workoutId' | 'startedAt' | 'endedAt'>[],
  today: Date,
): WeekPlan {
  const todayIso = toIsoDate(today);
  const start = weekStartOf(today);
  const doneOn = new Map<string, Set<string>>();
  for (const s of sessions) {
    if (s.endedAt === null) continue;
    const date = sessionDate(s);
    const set = doneOn.get(date) ?? new Set<string>();
    set.add(s.workoutId);
    doneOn.set(date, set);
  }

  let nextFound = false;
  const days: WeekDay[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const date = addDays(start, weekday - 1);
    const assigned = workoutsOn(workouts, weekday);
    const done = assigned.some((w) => doneOn.get(date)?.has(w.id));
    let state: DayState;
    if (assigned.length === 0) state = 'rest';
    else if (done) state = 'done';
    else if (date < todayIso) state = 'missed';
    else if (!nextFound) {
      state = 'next';
      nextFound = true;
    } else state = 'todo';
    days.push({
      weekday,
      date,
      workouts: assigned,
      tag: assigned[0] ? workoutTag(assigned[0].name) : '—',
      state,
      isToday: date === todayIso,
    });
  }

  return { days, next: findNext(days, workouts, start, todayIso) };
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromIsoDate(toIso).getTime() - fromIsoDate(fromIso).getTime()) / 86_400_000);
}

function findNext(days: readonly WeekDay[], workouts: readonly Workout[], weekStart: string, todayIso: string): NextWorkout | null {
  const thisWeek = days.find((d) => d.state === 'next');
  if (thisWeek?.workouts[0]) {
    return { workout: thisWeek.workouts[0], date: thisWeek.date, weekday: thisWeek.weekday, inDays: daysBetween(todayIso, thisWeek.date) };
  }
  // Settimana finita: il primo giorno con una scheda della settimana dopo.
  for (let weekday = 1; weekday <= 7; weekday++) {
    const first = workoutsOn(workouts, weekday)[0];
    if (first) {
      const date = addDays(weekStart, 7 + weekday - 1);
      return { workout: first, date, weekday, inDays: daysBetween(todayIso, date) };
    }
  }
  return null;
}

/** Giorno della settimana di una data locale `AAAA-MM-GG` (1 = lunedì). */
export function weekdayOf(iso: string): number {
  return isoWeekday(fromIsoDate(iso));
}
