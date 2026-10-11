import { z } from 'zod';
import { validate, type Result } from '../../data/errors';
import { MAX_ITEMS, MAX_TEXT } from '../../data/limits';
import { httpsUrl, requiredText, uniqueArray } from '../../data/schemas/common';
import type { Exercise } from '../../data/schemas/exercises';
import type { Workout } from '../../data/schemas/workouts';
import { EQUIPMENT, MUSCLES } from './muscles';

/** Esercizio personalizzato: muscoli e attrezzo dalle liste chiuse, almeno un muscolo (il primo è il principale). */
export const customExerciseInputSchema = z.object({
  name: requiredText(MAX_TEXT.name),
  muscles: uniqueArray(z.enum(MUSCLES), MAX_ITEMS.muscles, 'muscoli ripetuti').refine(
    (list) => list.length > 0,
    'scegli almeno un muscolo',
  ),
  equipment: z.enum(EQUIPMENT),
  videoUrl: httpsUrl.nullable(),
});

export type CustomExerciseInput = z.input<typeof customExerciseInputSchema>;

/** Valida i campi del modulo (link vuoto = nessun link). */
export function validateCustomExercise(input: {
  name: string;
  muscles: readonly string[];
  equipment: string;
  videoUrl: string;
}): Result<z.output<typeof customExerciseInputSchema>> {
  const url = input.videoUrl.trim();
  return validate(customExerciseInputSchema, { ...input, muscles: [...input.muscles], videoUrl: url === '' ? null : url });
}

/** Schede che usano un esercizio (per l'avviso prima di eliminarlo). */
export function workoutsUsing(workouts: readonly Workout[], exerciseId: string): Workout[] {
  return workouts.filter((w) => w.items.some((item) => item.exerciseId === exerciseId));
}

/** Testo dell'avviso di eliminazione. */
export function deleteWarning(exercise: Pick<Exercise, 'name'>, using: readonly Pick<Workout, 'name'>[]): string {
  if (using.length === 0) return `Eliminare «${exercise.name}» dalla libreria?`;
  const names = using.map((w) => `«${w.name}»`).join(', ');
  const count = using.length === 1 ? 'una scheda' : `${using.length} schede`;
  return `«${exercise.name}» è usato in ${count} (${names}). Le schede restano invariate: nome e muscoli sono copiati.`;
}
