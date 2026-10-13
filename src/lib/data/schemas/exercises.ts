import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { entityId, httpsUrl, requiredText, text, uniqueArray } from './common';

export const musclesSchema = uniqueArray(requiredText(MAX_TEXT.short), MAX_ITEMS.muscles, 'muscoli ripetuti');

/** Tipo di esercizio (2a): forza (serie × ripetizioni × kg) o cardio (minuti, distanza…). */
export const EXERCISE_KINDS = ['strength', 'cardio'] as const;
export const exerciseKindSchema = z.enum(EXERCISE_KINDS);
export type ExerciseKind = z.infer<typeof exerciseKindSchema>;

/** Campi facoltativi di un esercizio cardio (i minuti ci sono sempre). */
export const CARDIO_FIELDS = ['distance', 'speed', 'incline', 'level'] as const;
export const cardioFieldSchema = z.enum(CARDIO_FIELDS);
export type CardioField = z.infer<typeof cardioFieldSchema>;

/** Esercizio della libreria (id slug) o personalizzato (id UUID, `custom: true`). */
export const exerciseSchema = z.object({
  id: entityId,
  name: requiredText(MAX_TEXT.name),
  /** Esercizi cardio: `muscles` può essere vuoto. */
  muscles: musclesSchema,
  equipment: text(MAX_TEXT.name),
  videoUrl: httpsUrl.nullable(),
  custom: z.boolean(),
  kind: exerciseKindSchema,
  /** Cardio: campi che l'editor mostra subito (gli altri restano dietro "Altri campi"). `[]` per la forza. */
  cardioFields: uniqueArray(cardioFieldSchema, CARDIO_FIELDS.length, 'campi ripetuti'),
});

export type Exercise = z.infer<typeof exerciseSchema>;

/**
 * Esercizio della libreria inclusa nell'app (M4: id `fx-…`/`it-…`; 2a: cardio `cd-…`), non personalizzato.
 * È dell'app, non dei dati dell'utente: non entra nel backup né nei conteggi, "Svuota tutto"
 * e il ripristino non lo toccano (la libreria si ricarica comunque da sola, vedi `syncLibrary`).
 */
export function isBuiltInExercise(row: Pick<Exercise, 'id' | 'custom'>): boolean {
  return !row.custom && /^(fx|it|cd)-/.test(row.id);
}
