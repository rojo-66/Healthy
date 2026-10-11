import { workoutSchema, type Workout } from '../../../src/lib/data/schemas/workouts';
import { sessionSchema, type Session } from '../../../src/lib/data/schemas/sessions';
import { buildSession } from '../../../src/lib/sessions/create';
import { toggleSet } from '../../../src/lib/sessions/edit';
import workoutFixture from '../../fixtures/sessions/workout.json';

/** Scheda finta: panca (piramidale, 3 serie), lat machine (2), croci (senza id della libreria, 2) + cardio. */
export function sessionWorkout(): Workout {
  return workoutSchema.parse(structuredClone(workoutFixture));
}

export const READY = { sleep: 4, mood: 4, energy: 3, stress: 4, soreness: 5 } as const;

/** Lunedì 12 ottobre 2026, 18:00 (ora locale). */
export const START = new Date(2026, 9, 12, 18, 0);

export function newSession(overrides: Partial<{ id: string; workout: Workout; previous: Session | null; now: Date }> = {}): Session {
  return buildSession({
    id: overrides.id ?? 'sess-1',
    workout: overrides.workout ?? sessionWorkout(),
    readiness: { ...READY },
    previous: overrides.previous ?? null,
    now: overrides.now ?? START,
  });
}

/** Spunta le serie indicate `[itemIndex, setIndex]`. */
export function check(session: Session, ...sets: [number, number][]): Session {
  return sets.reduce((s, [i, k]) => toggleSet(s, i, k).session, session);
}

/** Valida con lo schema del database (lancia se non valida). */
export function valid(session: Session): Session {
  return sessionSchema.parse(session);
}
