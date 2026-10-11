import { validateCustomExercise, workoutsUsing } from '../../workouts/library/custom';
import { db } from '../db';
import { ValidationError } from '../errors';
import { newId } from '../ids';
import type { Exercise } from '../schemas/exercises';
import type { Workout } from '../schemas/workouts';
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

// --- Esercizi personalizzati (M4) ---

export interface CustomExerciseFields {
  name: string;
  muscles: readonly string[];
  equipment: string;
  /** Testo del campo: vuoto = nessun link. */
  videoUrl: string;
}

function checkFields(fields: CustomExerciseFields) {
  const result = validateCustomExercise(fields);
  if (!result.ok) throw new ValidationError(result.errors);
  return result.value;
}

export async function createCustomExercise(fields: CustomExerciseFields): Promise<Exercise> {
  const value = checkFields(fields);
  return exercisesRepo.add({ id: newId(), ...value, custom: true });
}

/** Modifica un esercizio personalizzato. Le schede che lo usano non cambiano: hanno la loro copia. */
export async function updateCustomExercise(id: string, fields: CustomExerciseFields): Promise<Exercise> {
  const value = checkFields(fields);
  const current = await db.exercises.get(id);
  if (!current?.custom) throw new ValidationError(['Si possono modificare solo gli esercizi personalizzati.']);
  return exercisesRepo.put({ ...current, ...value });
}

/** Schede che usano l'esercizio: da mostrare nell'avviso prima di eliminarlo. */
export async function customExerciseUsage(id: string): Promise<Workout[]> {
  return workoutsUsing(await db.workouts.toArray(), id);
}

/**
 * Elimina un esercizio personalizzato. Le schede che lo usano restano valide:
 * nome e muscoli sono copiati, l'`exerciseId` resta (lo storico del M5 lo usa per raggruppare).
 */
export async function deleteCustomExercise(id: string): Promise<void> {
  const current = await db.exercises.get(id);
  if (!current) return;
  if (!current.custom) throw new ValidationError(['Gli esercizi della libreria non si possono eliminare.']);
  await db.exercises.delete(id);
}
