import { db } from '../db';
import type { Exercise } from '../schemas/exercises';
import { createTableRepo } from './table-repo';

export const exercisesRepo = createTableRepo('exercises');

/** Libreria in ordine alfabetico. */
export function listExercisesByName(): Promise<Exercise[]> {
  return db.exercises.orderBy('name').toArray();
}

/** Esercizi che allenano un muscolo (indice multiEntry `*muscles`). */
export function exercisesForMuscle(muscle: string): Promise<Exercise[]> {
  return db.exercises.where('muscles').equals(muscle).sortBy('name');
}
