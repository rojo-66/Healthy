import type { Occurrence } from '../calendar/occurrences';
import type { Run, RunLog } from '../data/schemas/runs';
import type { Session } from '../data/schemas/sessions';
import type { Workout } from '../data/schemas/workouts';
import { minutesOfDay } from '../diet/calc/calendar';
import { toMinutes } from '../diet/calc/meal-now';
import { timeOfDay } from '../sessions/format';
import { workoutTotals } from '../workouts/calc/duration';
import { runLogLabel, runPlannedMinutes, targetLabel } from '../runs/format';
import { addMinutesToTime, nextMeta, workoutTimeRange } from '../workouts/format';
import type { DayRelation } from './meal-focus';

/** `todo` da fare · `in-progress` sessione in corso · `done` sessione conclusa quel giorno · `skipped` saltato (2c). */
export type WorkoutStatus = 'todo' | 'in-progress' | 'done' | 'skipped';

export interface WorkoutEntry {
  /** Chiave stabile per `{#each}`: chiave dell'occorrenza, o id della sessione per quelle fuori programma. */
  id: string;
  workoutId: string;
  name: string;
  /** La scheda (per avviarla); `null` se è stata eliminata e resta solo la sessione. */
  workout: Workout | null;
  /** In programma quel giorno (le altre sono sessioni "fuori programma"). */
  scheduled: boolean;
  status: WorkoutStatus;
  /** Occorrenza del calendario (2c), `null` per quelle fuori programma. */
  occurrence: Occurrence | null;
  /** Data originale se è stata spostata qui da un altro giorno. */
  movedFrom: string | null;
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

function workoutEntry(
  id: string,
  workout: Workout | null,
  workoutId: string,
  name: string,
  occurrence: Occurrence | null,
  session: Session | null,
): WorkoutEntry {
  const status: WorkoutStatus = occurrence?.skipped
    ? 'skipped'
    : session === null
      ? 'todo'
      : session.endedAt === null
        ? 'in-progress'
        : 'done';
  const durationMin = workout ? workoutTotals(workout).totalMin : null;
  const startMinutes = session ? local(session.startedAt) : workout?.time ? toMinutes(workout.time) : null;
  const timeLabel = session ? timeOfDay(session.startedAt) : workout ? workoutTimeRange(workout) : '';
  return {
    id,
    workoutId,
    name,
    workout,
    scheduled: occurrence !== null,
    status,
    occurrence,
    movedFrom: occurrence?.moved ? occurrence.originalDate : null,
    session,
    startMinutes,
    durationMin,
    timeLabel,
    meta: workout ? nextMeta(workout) : '',
  };
}

/**
 * Allenamenti di un giorno (2c): le occorrenze di quel giorno (anche spostate o saltate; schede per nome, come Allena)
 * più le sessioni fuori programma. `active` è la sessione in corso, se non è già collegata a un'occorrenza
 * (la Home la passa solo per oggi). `workouts` serve a ritrovare la scheda delle sessioni fuori programma.
 */
export function workoutsForDay(
  occurrences: readonly Occurrence[],
  extraSessions: readonly Session[],
  active: Session | null,
  workouts: readonly Workout[],
): WorkoutEntry[] {
  const list = occurrences
    .filter((o) => o.kind === 'workout')
    .map((o) => workoutEntry(o.key, o.workout, o.refId, o.name, o, o.session));

  const extra = new Map<string, Session>();
  for (const s of extraSessions) extra.set(s.workoutId, s);
  if (active && !occurrences.some((o) => o.session?.id === active.id)) extra.set(active.workoutId, active);
  for (const s of extra.values()) {
    list.push(workoutEntry(s.id, workouts.find((w) => w.id === s.workoutId) ?? null, s.workoutId, s.workoutName, null, s));
  }
  return list;
}

/** Corsa del giorno nella Home (2a): in programma quel giorno (anche spostata o saltata), oppure fuori programma. */
export interface RunEntry {
  /** Chiave stabile: chiave dell'occorrenza, o id della registrazione per quelle fuori programma. */
  id: string;
  runId: string | null;
  name: string;
  run: Run | null;
  scheduled: boolean;
  status: 'todo' | 'done' | 'skipped';
  occurrence: Occurrence | null;
  movedFrom: string | null;
  /** Corsa fatta quel giorno (l'ultima registrata). */
  log: RunLog | null;
  /** Orario della corsa pianificata, in minuti. */
  startMinutes: number | null;
  /** Durata prevista (obiettivo in minuti, o stimata dai km). */
  durationMin: number | null;
  /** "07:00–07:30" con l'orario, altrimenti "". */
  timeLabel: string;
  /** "obiettivo 30′ · 5 km", oppure, se fatta, "32:10 · 5,2 km · 6:11/km · RPE 6". */
  meta: string;
}

/** Corse di un giorno: le occorrenze di quel giorno più quelle fatte fuori programma. */
export function runsForDay(occurrences: readonly Occurrence[], extraLogs: readonly RunLog[]): RunEntry[] {
  const list: RunEntry[] = occurrences
    .filter((o) => o.kind === 'run' && o.run)
    .map((o) => {
      const run = o.run!;
      const log = o.log;
      const durationMin = runPlannedMinutes(run);
      const target = targetLabel(run);
      return {
        id: o.key,
        runId: run.id,
        name: run.name,
        run,
        scheduled: true,
        status: o.skipped ? 'skipped' : log ? 'done' : 'todo',
        occurrence: o,
        movedFrom: o.moved ? o.originalDate : null,
        log,
        startMinutes: run.time ? toMinutes(run.time) : null,
        durationMin,
        timeLabel: run.time ? `${run.time}–${addMinutesToTime(run.time, durationMin)}` : '',
        meta: log ? runLogLabel(log) : target ? `obiettivo ${target}` : '',
      };
    });
  for (const log of extraLogs) {
    list.push({
      id: log.id,
      runId: log.runId,
      name: log.runName,
      run: null,
      scheduled: false,
      status: 'done',
      occurrence: null,
      movedFrom: null,
      log,
      startMinutes: null,
      durationMin: null,
      timeLabel: '',
      meta: runLogLabel(log),
    });
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
  if (e.status === 'skipped') return 'saltato';
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
