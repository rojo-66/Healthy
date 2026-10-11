import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { entityId, int, text, weekday } from './common';
import { kgSchema, repsSchema, restSecSchema, setDetailSchema, versionSchema } from './workouts';

/**
 * Bozza dell'editor schede (M4): lo stato del modulo così com'è, anche incompleto
 * (nome vuoto, link video ancora da finire di scrivere). Si salva in `settings.workoutDraft`
 * e diventa una scheda solo passando da `workoutEditorSchema`.
 */

/** Chiave locale di una riga (riordino, `{#each}`): non finisce mai nella scheda salvata. */
const rowKey = z.string().min(1).max(MAX_TEXT.key);

export const draftWarmupSchema = z.object({
  key: rowKey,
  name: text(MAX_TEXT.name),
  hint: text(MAX_TEXT.note),
  dose: text(MAX_TEXT.short),
});

export const draftItemSchema = z.object({
  key: rowKey,
  exerciseId: entityId.nullable(),
  name: text(MAX_TEXT.name),
  muscles: z.array(text(MAX_TEXT.short)).max(MAX_ITEMS.muscles),
  sets: int(0, MAX_ITEMS.setsPerItem),
  reps: repsSchema,
  kg: kgSchema,
  restSec: restSecSchema,
  note: text(MAX_TEXT.note),
  /** Testo del campo: `''` = nessun link. */
  videoUrl: z.string().max(MAX_TEXT.url),
  setsDetail: z.array(setDetailSchema).max(MAX_ITEMS.setsPerItem).nullable(),
  /** Dettaglio delle serie piramidali appena disattivate: riattivando si ritrova. */
  setsDetailMemory: z.array(setDetailSchema).max(MAX_ITEMS.setsPerItem).nullable(),
});

export const draftCardioSchema = z.object({
  type: text(MAX_TEXT.short),
  minutes: int(0, 600),
});

export const workoutDraftSchema = z.object({
  /** Id della scheda: quella in modifica, oppure un UUID nuovo. */
  workoutId: entityId,
  /** Versione da cui parte la modifica; `null` = scheda nuova. */
  baseVersion: versionSchema.nullable(),
  source: z.enum(['pt', 'own']),
  author: text(MAX_TEXT.name),
  name: text(MAX_TEXT.name),
  weekdays: z.array(weekday).max(7),
  intro: text(MAX_TEXT.long),
  warmup: z.array(draftWarmupSchema).max(MAX_ITEMS.warmup),
  items: z.array(draftItemSchema).max(MAX_ITEMS.workoutItems),
  cardio: draftCardioSchema.nullable(),
});

/** Bozza salvata: cosa e quando. */
export const savedDraftSchema = z.object({
  savedAt: z.iso.datetime(),
  draft: workoutDraftSchema,
});

export type WorkoutDraft = z.infer<typeof workoutDraftSchema>;
export type DraftItem = z.infer<typeof draftItemSchema>;
export type DraftWarmup = z.infer<typeof draftWarmupSchema>;
export type DraftCardio = z.infer<typeof draftCardioSchema>;
export type SavedDraft = z.infer<typeof savedDraftSchema>;

/** Nome e origine predefinita di chi crea le schede (provvisorio fino al Profilo, M7). */
export const workoutAuthorSchema = z.object({
  name: text(MAX_TEXT.name),
  lastSource: z.enum(['pt', 'own']),
});

export type WorkoutAuthor = z.infer<typeof workoutAuthorSchema>;
