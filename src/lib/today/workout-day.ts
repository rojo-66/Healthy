import type { Session } from '../data/schemas/sessions';
import type { Workout } from '../data/schemas/workouts';
import { minutesOfDay } from '../diet/calc/calendar';
import { toMinutes } from '../diet/calc/meal-now';
import { sessionDate } from '../sessions/calendar';
import { timeOfDay } from '../sessions/format';
import { workoutTotals } from '../workouts/calc/duration';
import { workoutsOn } from '../workouts/calc/week';
import { nextMeta, workoutTimeRange } from '../workouts/format';
import type { DayRelation } from './meal-focus';

/** `todo` da fare · `in-progress` sessione in corso · `done` sessione conclusa quel giorno. */
export type WorkoutStatus = 'todo' | 'in-progress' | 'done';

export interface WorkoutEntry {
  /** Chiave stabile per `{#each}`: id della scheda, o della sessione per quelle fuori programma. */
  id: string;
  workoutId: string;
  name: string;
  /** La scheda (per avviarla); `null` se è stata eliminata e resta solo la sessione. */
  workout: Workout | null;
  /** Assegnata a quel giorno della settimana (le altre sono sessioni "fuori programma"). */
  scheduled: boolean;
  status: WorkoutStatus;
  /** Sessione conclusa (per il Riepilogo) o in corso. */
  session: Session | null;
  /** Inizio in minuti: inizio reale della sessione, altrimenti orario della scheda. */
  startMinutes: number | null;
  /** Durata stimata della scheda (minuti). */
  durationMin: number | null;
  /** "18:00–19:15" (orario della scheda), oppure "18:42" (inizio reale), oppure "". */
  timeLabel: string;
  /** "5 esercizi · 18 serie · ~70’ + 12’ tapis roulant". */
  meta: string;
}

const local = (iso: string) => minutesOfDay(new Date(iso));

/**
 * Allenamenti di un giorno: le schede assegnate a quel giorno della settimana (ordine per nome, come Allena)
 * più le sessioni di quel giorno con schede non assegnate. `active` è la sessione in corso, se c'è
 * (la Home la passa solo per oggi).
 */
export function workoutsForDay(
  workouts: readonly Workout[],
  sessions: readonly Session[],
  date: string,
  weekday: number,
  active: Session | null,
): WorkoutEntry[] {
  const ofDay = sessions
    .filter((s) => s.endedAt !== null && sessionDate(s) === date)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const lastDone = (workoutId: string) => ofDay.filter((s) => s.workoutId === workoutId).at(-1) ?? null;

  const entry = (workout: Workout | null, workoutId: string, name: string, scheduled: boolean, session: Session | null): WorkoutEntry => {
    const status: WorkoutStatus = session === null ? 'todo' : session.endedAt === null ? 'in-progress' : 'done';
    const durationMin = workout ? workoutTotals(workout).totalMin : null;
    const startMinutes = session ? local(session.startedAt) : workout?.time ? toMinutes(workout.time) : null;
    const timeLabel = session ? timeOfDay(session.startedAt) : workout ? workoutTimeRange(workout) : '';
    return {
      id: scheduled ? workoutId : (session?.id ?? workoutId),
      workoutId,
      name,
      workout,
      scheduled,
      status,
      session,
      startMinutes,
      durationMin,
      timeLabel,
      meta: workout ? nextMeta(workout) : '',
    };
  };

  const assigned = workoutsOn(workouts, weekday);
  const list = assigned.map((w) => entry(w, w.id, w.name, true, active?.workoutId === w.id ? active : lastDone(w.id)));

  const extra = new Map<string, Session>();
  for (const s of ofDay) if (!assigned.some((w) => w.id === s.workoutId)) extra.set(s.workoutId, s);
  if (active && !assigned.some((w) => w.id === active.workoutId)) extra.set(active.workoutId, active);
  for (const s of extra.values()) {
    list.push(entry(workouts.find((w) => w.id === s.workoutId) ?? null, s.workoutId, s.workoutName, false, s));
  }
  return list;
}

/** "tra 5 h 20 min", "tra 40 min". */
export function inTimeLabel(minutes: number): string {
  if (minutes < 60) return `tra ${Math.max(1, minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `tra ${h} h` : `tra ${h} h ${m} min`;
}

/** Testo accanto all'orario nella card: quando, rispetto ad adesso. */
export function workoutWhen(e: WorkoutEntry, relation: DayRelation, nowMinutes: number): string {
  if (e.status === 'in-progress') return 'in corso';
  if (e.status === 'done') return e.session?.endedAt ? `fatto alle ${timeOfDay(e.session.endedAt)}` : 'fatto';
  if (relation === 'past') return 'non fatto';
  if (relation === 'future') return 'in programma';
  if (e.startMinutes === null) return 'oggi';
  const until = e.startMinutes - nowMinutes;
  if (until > 0) return inTimeLabel(until);
  if (until > -(e.durationMin ?? 0)) return 'adesso';
  return 'orario passato';
}
