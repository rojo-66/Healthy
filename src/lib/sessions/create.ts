import { nowIso } from '../data/ids';
import type { Readiness, Session, SessionSet } from '../data/schemas/sessions';
import type { Workout, WorkoutItem } from '../data/schemas/workouts';
import { emptyCardioEntry } from './cardio';
import { lastTimeTable, prefill } from './last-time';

export interface NewSessionInput {
  id: string;
  workout: Workout;
  readiness: Readiness | null;
  /** Ultima sessione conclusa con la stessa scheda (per precompilare kg e ripetizioni). */
  previous: Pick<Session, 'snapshot' | 'sets'> | null | undefined;
  now: Date;
}

/** Copia campo per campo (non structuredClone: la scheda può arrivare da uno stato reattivo di Svelte). */
function copyItem(item: WorkoutItem): WorkoutItem {
  if (item.kind === 'cardio') return { ...item };
  return { ...item, muscles: [...item.muscles], setsDetail: item.setsDetail ? item.setsDetail.map((d) => ({ ...d })) : null };
}

/**
 * Sessione nuova al tocco su "Inizia allenamento": copia della scheda, tutte le serie del piano
 * precompilate e da fare, una voce vuota per ogni cardio, primo esercizio aperto, nessun recupero.
 */
export function buildSession({ id, workout, readiness, previous, now }: NewSessionInput): Session {
  const last = lastTimeTable(workout.items, previous);
  const sets: SessionSet[] = workout.items.flatMap((item, itemIndex) =>
    item.kind === 'cardio'
      ? []
      : Array.from({ length: item.sets }, (_, setIndex) => ({
      exerciseId: item.exerciseId,
      itemIndex,
      setIndex,
      ...prefill(item, setIndex, last[itemIndex]?.[setIndex]),
      done: false,
    })),
  );
  return {
    id,
    workoutId: workout.id,
    workoutVersion: workout.version,
    workoutName: workout.name,
    startedAt: nowIso(now),
    endedAt: null,
    readiness,
    sets,
    userNotes: [],
    rpe: null,
    cardio: workout.items.flatMap((item, itemIndex) => (item.kind === 'cardio' ? [emptyCardioEntry(itemIndex)] : [])),
    snapshot: { items: workout.items.map(copyItem) },
    live: { itemIndex: 0, rest: null },
  };
}
