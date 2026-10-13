import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { entityId, envelope, hhmm, httpsUrl, requiredText, text } from './common';
import { musclesSchema } from './exercises';
import {
  cardioMinutesSchema,
  checkSetsDetail,
  distanceKmSchema,
  inclinePctSchema,
  kgSchema,
  levelSchema,
  repsSchema,
  restSecSchema,
  setDetailSchema,
  setsSchema,
  speedKmhSchema,
  versionSchema,
  warmupItemSchema,
  weekdaysSchema,
} from './workouts';

export const WORKOUT_FILE_KIND = 'workout';
/** 2: esercizi con `kind` (forza o cardio), niente `cardio` finale. La v1 si legge ancora (`workoutFileV1ToV2`). */
export const WORKOUT_FILE_VERSION = 2;

/** Esercizio di forza nel file condiviso: niente `exerciseId` (il collegamento alla libreria avviene all'import, M8). */
const fileStrengthSchema = z
  .object({
    kind: z.literal('strength'),
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

/** Esercizio cardio nel file condiviso (2a). */
const fileCardioSchema = z.object({
  kind: z.literal('cardio'),
  name: requiredText(MAX_TEXT.name),
  minutes: cardioMinutesSchema,
  distanceKm: distanceKmSchema.nullable().default(null),
  speedKmh: speedKmhSchema.nullable().default(null),
  inclinePct: inclinePctSchema.nullable().default(null),
  level: levelSchema.nullable().default(null),
  note: text(MAX_TEXT.note).default(''),
  videoUrl: httpsUrl.nullable().default(null),
});

export const fileItemSchema = z.discriminatedUnion('kind', [fileStrengthSchema, fileCardioSchema]);

/** File di una scheda (SPEC § 8.1). I campi facoltativi hanno un valore neutro. */
export const workoutFileSchema = z.object({
  ...envelope(WORKOUT_FILE_KIND, WORKOUT_FILE_VERSION),
  id: entityId,
  version: versionSchema,
  author: text(MAX_TEXT.name).default(''),
  /**
   * Come l'ha creata chi la manda (M8, facoltativo): `pt` = "Come PT", `own` = scheda personale di un amico.
   * I file senza questo campo (prima di M8) sono del PT.
   */
  source: z.enum(['pt', 'own']).default('pt'),
  name: requiredText(MAX_TEXT.name),
  weekdays: weekdaysSchema.default([]),
  time: hhmm.nullable().default(null),
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
});

export type WorkoutFile = z.infer<typeof workoutFileSchema>;
export type WorkoutFileItem = z.infer<typeof fileItemSchema>;
