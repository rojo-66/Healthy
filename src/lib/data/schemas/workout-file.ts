import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { entityId, envelope, httpsUrl, requiredText, text } from './common';
import { musclesSchema } from './exercises';
import {
  cardioSchema,
  checkSetsDetail,
  kgSchema,
  repsSchema,
  restSecSchema,
  setDetailSchema,
  setsSchema,
  versionSchema,
  warmupItemSchema,
  weekdaysSchema,
} from './workouts';

export const WORKOUT_FILE_KIND = 'workout';
export const WORKOUT_FILE_VERSION = 1;

/** Esercizio nel file condiviso: niente `exerciseId` (il collegamento alla libreria avviene all'import, M8). */
const fileItemSchema = z
  .object({
    name: requiredText(MAX_TEXT.name),
    muscles: musclesSchema.default([]),
    sets: setsSchema,
    reps: repsSchema,
    kg: kgSchema,
    restSec: restSecSchema,
    note: text(MAX_TEXT.note).default(''),
    videoUrl: httpsUrl.nullable().default(null),
    setsDetail: z.array(setDetailSchema).max(MAX_ITEMS.setsPerItem).nullable().default(null),
  })
  .superRefine(checkSetsDetail);

/** File di una scheda (SPEC § 8.1). I campi facoltativi hanno un valore neutro. */
export const workoutFileSchema = z.object({
  ...envelope(WORKOUT_FILE_KIND, WORKOUT_FILE_VERSION),
  id: entityId,
  version: versionSchema,
  author: text(MAX_TEXT.name).default(''),
  name: requiredText(MAX_TEXT.name),
  weekdays: weekdaysSchema.default([]),
  intro: text(MAX_TEXT.long).default(''),
  warmup: z
    .array(
      warmupItemSchema.extend({
        hint: text(MAX_TEXT.note).default(''),
        dose: text(MAX_TEXT.short).default(''),
      }),
    )
    .max(MAX_ITEMS.warmup)
    .default([]),
  items: z.array(fileItemSchema).min(1).max(MAX_ITEMS.workoutItems),
  cardio: cardioSchema.nullable().default(null),
});

export type WorkoutFile = z.infer<typeof workoutFileSchema>;
