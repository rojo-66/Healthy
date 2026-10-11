import type { z } from 'zod';
import { italianErrorMap } from '../../data/errors';
import type { WorkoutDraft } from '../../data/schemas/workout-draft';
import { workoutSchema, type Workout } from '../../data/schemas/workouts';
import { draftToCandidate } from '../draft';
import { REPS_MIN } from './values';

/**
 * Regole dell'editor, più severe del database (che accetta anche schede importate con 0 ripetizioni):
 * almeno un esercizio, almeno 1 ripetizione per serie, nome dell'autore per le schede del PT.
 */
export const workoutEditorSchema = workoutSchema.superRefine((w, ctx) => {
  if (w.items.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'aggiungi almeno un esercizio' });
  }
  w.items.forEach((item, i) => {
    if (item.reps < REPS_MIN) {
      ctx.addIssue({ code: 'custom', path: ['items', i, 'reps'], message: 'almeno 1 ripetizione' });
    }
    item.setsDetail?.forEach((set, j) => {
      if (set.reps < REPS_MIN) {
        ctx.addIssue({ code: 'custom', path: ['items', i, 'setsDetail', j, 'reps'], message: 'almeno 1 ripetizione' });
      }
    });
  });
  if (w.source === 'pt' && w.author.trim() === '') {
    ctx.addIssue({ code: 'custom', path: ['author'], message: 'scrivi il nome del PT' });
  }
});

/** Errori per campo: chiave = percorso con i punti (`items.2.reps`, `name`), valore = messaggio in italiano. */
export type FieldErrors = Readonly<Record<string, string>>;

export type DraftValidation = { ok: true; value: Workout } | { ok: false; fields: FieldErrors; count: number };

function pathKey(path: readonly PropertyKey[]): string {
  return path.map(String).join('.');
}

/** Valida la bozza come scheda; gli errori tornano per campo, da mostrare accanto a ciascuno. */
export function validateDraft(draft: WorkoutDraft, now: Date = new Date()): DraftValidation {
  const parsed = workoutEditorSchema.safeParse(draftToCandidate(draft, now), { error: italianErrorMap });
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, ...collectFieldErrors(parsed.error.issues) };
}

export function collectFieldErrors(issues: readonly z.core.$ZodIssue[]): { fields: FieldErrors; count: number } {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = pathKey(issue.path);
    if (!(key in fields)) fields[key] = issue.message;
  }
  return { fields, count: Object.keys(fields).length };
}

/** Indice del primo esercizio con un errore (per aprirlo e mostrarlo), oppure `null`. */
export function firstItemWithError(fields: FieldErrors): number | null {
  let first: number | null = null;
  for (const key of Object.keys(fields)) {
    const match = /^items\.(\d+)\./.exec(key);
    if (match) {
      const i = Number(match[1]);
      if (first === null || i < first) first = i;
    }
  }
  return first;
}

/** Errori di un esercizio (chiavi senza il prefisso `items.N.`). */
export function itemErrors(fields: FieldErrors, index: number): FieldErrors {
  const prefix = `items.${index}.`;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(fields)) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message;
  }
  return out;
}
