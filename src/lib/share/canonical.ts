import { parseOrThrow, validate } from '../data/errors';
import { APP_ID } from '../data/schemas/common';
import type { DietFile } from '../data/schemas/diet-file';
import type { DietPlan } from '../data/schemas/diet-plans';
import type { WorkoutAuthor } from '../data/schemas/workout-draft';
import { WORKOUT_FILE_KIND, WORKOUT_FILE_VERSION, workoutFileSchema, type WorkoutFile } from '../data/schemas/workout-file';
import type { WorkoutVersion } from '../data/schemas/workouts';
import { planToDietFile } from '../diet/import/export';
import type { z } from 'zod';
import { canonicalJson, shareableContent } from './workout-content';

/**
 * File di condivisione costruiti da una **lista bianca** di campi (SPEC § 8.4): niente note personali,
 * cronologia, id interni o campi che il database dovesse avere in più. Ogni file è validato prima di uscire.
 */
export { canonicalJson, contentHash, shareableContent, type ShareableWorkoutContent } from './workout-content';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Autore scritto nel file: quello della scheda; per una **mia** scheda personale (che non ha autore)
 * il mio nome del Profilo, così chi la riceve vede da chi arriva.
 */
export function shareAuthor(w: Pick<WorkoutVersion, 'author' | 'received'>, me: WorkoutAuthor): string {
  const own = w.author.trim();
  if (own !== '') return own;
  return w.received === null ? me.name.trim() : '';
}

/** Scheda → file § 8.1 (con `source`, M8). Lancia `ValidationError` se la scheda non è condivisibile. */
export function workoutToShareFile(w: WorkoutVersion, me: WorkoutAuthor): WorkoutFile {
  return parseOrThrow(workoutFileSchema, {
    app: APP_ID,
    kind: WORKOUT_FILE_KIND,
    schemaVersion: WORKOUT_FILE_VERSION,
    id: w.id,
    version: w.version,
    author: shareAuthor(w, me),
    source: w.source,
    ...shareableContent(w),
  });
}

/** Piano → file § 8.2 (lista bianca in `planToDietFile`). */
export function dietToShareFile(plan: DietPlan): DietFile {
  return planToDietFile(plan);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return isRecord(value) && Object.keys(value).length === 0;
}

function stripEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (!isEmptyValue(inner)) out[key] = stripEmpty(inner);
  }
  return out;
}

/**
 * Forma compatta per link e QR: senza i campi vuoti (`null`, `""`, `[]`, `{}`), che lo schema rimette
 * da solo. Se togliendoli il file non tornasse identico, resta la forma completa.
 */
export function compactForLink<S extends z.ZodType>(file: z.output<S>, schema: S): unknown {
  const compact = stripEmpty(file);
  const back = validate(schema, compact);
  return back.ok && canonicalJson(back.value) === canonicalJson(file) ? compact : file;
}
