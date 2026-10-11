import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { entityId, httpsUrl, requiredText, text, uniqueArray } from './common';

export const musclesSchema = uniqueArray(requiredText(MAX_TEXT.short), MAX_ITEMS.muscles, 'muscoli ripetuti');

/** Esercizio della libreria (id slug) o personalizzato (id UUID, `custom: true`). */
export const exerciseSchema = z.object({
  id: entityId,
  name: requiredText(MAX_TEXT.name),
  muscles: musclesSchema,
  equipment: text(MAX_TEXT.name),
  videoUrl: httpsUrl.nullable(),
  custom: z.boolean(),
});

export type Exercise = z.infer<typeof exerciseSchema>;

/**
 * Esercizio della libreria inclusa nell'app (M4: id `fx-…`/`it-…`, non personalizzato).
 * È dell'app, non dei dati dell'utente: non entra nel backup né nei conteggi, "Svuota tutto"
 * e il ripristino non lo toccano (la libreria si ricarica comunque da sola, vedi `syncLibrary`).
 */
export function isBuiltInExercise(row: Pick<Exercise, 'id' | 'custom'>): boolean {
  return !row.custom && /^(fx|it)-/.test(row.id);
}
