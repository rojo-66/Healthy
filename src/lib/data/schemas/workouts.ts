import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { musclesSchema } from './exercises';
import { entityId, hhmm, httpsUrl, int, isoDateTime, num, requiredText, text, uniqueArray, weekday } from './common';

export const setsSchema = int(1, MAX_ITEMS.setsPerItem);
export const repsSchema = int(0, 1000);
export const kgSchema = num(0, 1000);
export const restSecSchema = int(0, 900);
export const versionSchema = int(1, 100000);

/** Limiti dei valori cardio nel database e nei file (l'editor è più severo, vedi `calc/values.ts`). */
export const cardioMinutesSchema = int(0, 600);
export const distanceKmSchema = num(0, 500);
export const speedKmhSchema = num(0, 100);
export const inclinePctSchema = num(0, 50);
export const levelSchema = int(0, 100);

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

/** Esercizio di forza della scheda: serie × ripetizioni × kg. */
export const strengthItemSchema = z
  .object({
    kind: z.literal('strength'),
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

/**
 * Esercizio cardio della scheda (2a): minuti previsti e, se servono, distanza, velocità, pendenza o livello.
 * Niente serie, ripetizioni né kg. `minutes` può essere 0 nel database (file importati); l'editor chiede almeno 1.
 */
export const cardioItemSchema = z.object({
  kind: z.literal('cardio'),
  exerciseId: entityId.nullable(),
  name: requiredText(MAX_TEXT.name),
  minutes: cardioMinutesSchema,
  distanceKm: distanceKmSchema.nullable(),
  speedKmh: speedKmhSchema.nullable(),
  inclinePct: inclinePctSchema.nullable(),
  level: levelSchema.nullable(),
  note: text(MAX_TEXT.note),
  videoUrl: httpsUrl.nullable(),
});

/** Un elemento della scheda: esercizio di forza o cardio, nell'ordine scelto dal PT (2a). */
export const workoutItemSchema = z.discriminatedUnion('kind', [strengthItemSchema, cardioItemSchema]);

/**
 * Scheda ricevuta da un altro (M8): versione e impronta del contenuto al momento dell'import.
 * Servono a capire se la scheda è stata modificata qui dopo l'import (SPEC § 8.4).
 */
export const receivedSchema = z.object({
  version: versionSchema,
  /** `fnv1a` del contenuto condivisibile (lista bianca, JSON canonico), in esadecimale. */
  hash: z.string().regex(/^[0-9a-f]{8}$/, 'impronta non valida'),
  at: isoDateTime,
});

/** Una scheda senza la sua cronologia: è anche la forma delle versioni conservate (M8). */
export const workoutVersionSchema = z.object({
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
  /** Esercizi di forza e cardio (2a: il vecchio "cardio finale" è diventato un esercizio cardio in fondo). */
  items: z.array(workoutItemSchema).max(MAX_ITEMS.workoutItems),
  updatedAt: isoDateTime,
  /** Ricevuta con link, QR o file (M8); `null` = creata su questo telefono. */
  received: receivedSchema.nullable().default(null),
});

/** Scheda (SPEC § 7, `workouts`). */
export const workoutSchema = workoutVersionSchema.extend({
  /** Versioni sostituite da un import (M8), dalla più recente; al massimo `MAX_ITEMS.previousVersions`. */
  previousVersions: z.array(workoutVersionSchema).max(MAX_ITEMS.previousVersions).default([]),
});

export type Workout = z.infer<typeof workoutSchema>;
export type WorkoutVersion = z.infer<typeof workoutVersionSchema>;
export type Received = z.infer<typeof receivedSchema>;
export type WorkoutItem = z.infer<typeof workoutItemSchema>;
export type StrengthItem = z.infer<typeof strengthItemSchema>;
export type CardioItem = z.infer<typeof cardioItemSchema>;
export type WarmupItem = z.infer<typeof warmupItemSchema>;

export function isStrengthItem<T extends { kind: string }>(item: T): item is Extract<T, { kind: 'strength' }> {
  return item.kind === 'strength';
}

export function isCardioItem<T extends { kind: string }>(item: T): item is Extract<T, { kind: 'cardio' }> {
  return item.kind === 'cardio';
}
