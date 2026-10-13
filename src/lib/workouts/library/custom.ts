import { z } from 'zod';
import { validate, type Result } from '../../data/errors';
import { MAX_ITEMS, MAX_TEXT } from '../../data/limits';
import { httpsUrl, requiredText, uniqueArray } from '../../data/schemas/common';
import { CARDIO_FIELDS, exerciseKindSchema, type Exercise } from '../../data/schemas/exercises';
import type { Workout } from '../../data/schemas/workouts';
import { EQUIPMENT, MUSCLES } from './muscles';

/**
 * Esercizio personalizzato: tipo (forza o cardio, 2a), muscoli e attrezzo dalle liste chiuse.
 * Forza: almeno un muscolo (il primo è il principale). Cardio: muscoli facoltativi, l'editor mostra tutti i campi.
 */
export const customExerciseInputSchema = z
  .object({
    name: requiredText(MAX_TEXT.name),
    kind: exerciseKindSchema,
    muscles: uniqueArray(z.enum(MUSCLES), MAX_ITEMS.muscles, 'muscoli ripetuti'),
    equipment: z.enum(EQUIPMENT),
    videoUrl: httpsUrl.nullable(),
  })
  .superRefine((input, ctx) => {
    if (input.kind === 'strength' && input.muscles.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['muscles'], message: 'scegli almeno un muscolo' });
    }
  })
  .transform((input) => ({ ...input, cardioFields: input.kind === 'cardio' ? [...CARDIO_FIELDS] : [] }));

export type CustomExerciseInput = z.input<typeof customExerciseInputSchema>;

/** Valida i campi del modulo (link vuoto = nessun link). */
export function validateCustomExercise(input: {
  name: string;
  kind: 'strength' | 'cardio';
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
