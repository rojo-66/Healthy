import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { musclesSchema } from './exercises';
import { entityId, hhmm, httpsUrl, int, isoDateTime, num, requiredText, text, uniqueArray, weekday } from './common';

export const setsSchema = int(1, MAX_ITEMS.setsPerItem);
export const repsSchema = int(0, 1000);
export const kgSchema = num(0, 1000);
export const restSecSchema = int(0, 900);
export const versionSchema = int(1, 100000);

export const weekdaysSchema = uniqueArray(weekday, 7, 'giorni ripetuti');

export const warmupItemSchema = z.object({
  name: requiredText(MAX_TEXT.name),
  hint: text(MAX_TEXT.note),
  dose: text(MAX_TEXT.short),
});

/** Una serie di una scheda "piramidale" (Serie diverse tra loro). */
export const setDetailSchema = z.object({
  reps: repsSchema,
  kg: kgSchema,
});

export const cardioSchema = z.object({
  type: requiredText(MAX_TEXT.short),
  minutes: int(0, 600),
});

/** Con "Serie diverse tra loro" serve un dettaglio per ogni serie. */
export function checkSetsDetail(
  item: { sets: number; setsDetail: readonly unknown[] | null },
  ctx: z.RefinementCtx,
): void {
  if (item.setsDetail !== null && item.setsDetail.length !== item.sets) {
    ctx.addIssue({
      code: 'custom',
      path: ['setsDetail'],
      message: `servono ${item.sets} serie nel dettaglio, ce ne sono ${item.setsDetail.length}`,
    });
  }
}

export const workoutItemSchema = z
  .object({
    /** Esercizio della libreria; `null` se arriva da un file condiviso e non è ancora collegato. */
    exerciseId: entityId.nullable(),
    name: requiredText(MAX_TEXT.name),
    muscles: musclesSchema,
    sets: setsSchema,
    reps: repsSchema,
    kg: kgSchema,
    restSec: restSecSchema,
    note: text(MAX_TEXT.note),
    videoUrl: httpsUrl.nullable(),
    setsDetail: z.array(setDetailSchema).max(MAX_ITEMS.setsPerItem).nullable(),
  })
  .superRefine(checkSetsDetail);

/** Scheda (SPEC § 7, `workouts`). */
export const workoutSchema = z.object({
  id: entityId,
  version: versionSchema,
  author: text(MAX_TEXT.name),
  source: z.enum(['pt', 'own']),
  name: requiredText(MAX_TEXT.name),
  weekdays: weekdaysSchema,
  /** Orario abituale (M6, facoltativo): uno per scheda, vale in tutti i giorni assegnati. */
  time: hhmm.nullable().default(null),
  intro: text(MAX_TEXT.long),
  warmup: z.array(warmupItemSchema).max(MAX_ITEMS.warmup),
  items: z.array(workoutItemSchema).max(MAX_ITEMS.workoutItems),
  cardio: cardioSchema.nullable(),
  updatedAt: isoDateTime,
});

export type Workout = z.infer<typeof workoutSchema>;
export type WorkoutItem = z.infer<typeof workoutItemSchema>;
export type WarmupItem = z.infer<typeof warmupItemSchema>;
export type Cardio = z.infer<typeof cardioSchema>;
