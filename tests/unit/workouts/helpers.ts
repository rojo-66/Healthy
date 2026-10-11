import { z } from 'zod';
import { exerciseSchema, type Exercise } from '../../../src/lib/data/schemas/exercises';
import type { WorkoutAuthor } from '../../../src/lib/data/schemas/workout-draft';
import { workoutSchema, type Workout } from '../../../src/lib/data/schemas/workouts';
import customFixture from '../../fixtures/workouts/custom-exercise.json';
import weekFixture from '../../fixtures/workouts/week.json';

/** Schede finte (4): PT "Petto + Schiena" (L), PT "Gambe" (M), TUA "Àddome e mobilità" (Me, S), TUA "Braccia" (nessun giorno). */
export function weekWorkouts(): Workout[] {
  return z.array(workoutSchema).parse(structuredClone(weekFixture));
}

export function workoutNamed(name: string): Workout {
  const w = weekWorkouts().find((x) => x.name === name);
  if (!w) throw new Error(`Scheda di prova «${name}» mancante`);
  return w;
}

export function customExercise(): Exercise {
  return exerciseSchema.parse(structuredClone(customFixture));
}

export const ME_OWN: WorkoutAuthor = { name: '', lastSource: 'own' };
export const ME_PT: WorkoutAuthor = { name: 'Coach Finto', lastSource: 'pt' };
/** Io sono lo stesso PT che ha scritto le schede di prova. */
export const SAME_PT: WorkoutAuthor = { name: 'pt di prova', lastSource: 'pt' };

/** Lunedì 12 ottobre 2026, 13:00 (ora locale). */
export const MONDAY = new Date(2026, 9, 12, 13, 0);

export function onDay(base: Date, plusDays: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + plusDays);
  return d;
}
