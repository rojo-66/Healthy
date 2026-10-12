import { dietFileSchema } from '../data/schemas/diet-file';
import type { DietPlan } from '../data/schemas/diet-plans';
import type { WorkoutAuthor } from '../data/schemas/workout-draft';
import { workoutFileSchema } from '../data/schemas/workout-file';
import type { WorkoutVersion } from '../data/schemas/workouts';
import { dietFileName } from '../diet/import/export';
import { shareAvailability, type ShareAvailability } from './availability';
import { compactForLink, dietToShareFile, workoutToShareFile } from './canonical';
import { appBaseUrl, encodeShare } from './codec';
import { workoutShareFileName } from './file-name';

/**
 * Tutto ciò che serve al pannello Condividi, preparato **prima** del tocco: Safari accetta
 * `navigator.share` solo subito dentro il gesto, senza attese in mezzo.
 */
export interface PreparedShare {
  kind: 'workout' | 'diet';
  /** Nome mostrato e titolo del foglio di condivisione. */
  name: string;
  version: number;
  /** File `.json` leggibile (forma completa, con a capo). */
  file: File;
  /** Link `…/#import=…` (forma compatta). */
  url: string;
  /** Codice da incollare. */
  payload: string;
  availability: ShareAvailability;
}

function jsonFile(content: unknown, name: string): File {
  return new File([JSON.stringify(content, null, 2)], name, { type: 'application/json' });
}

/** Scheda → pannello. Lancia `ValidationError` se la scheda non è condivisibile (es. senza esercizi). */
export function prepareWorkoutShare(w: WorkoutVersion, me: WorkoutAuthor, baseUrl: string = appBaseUrl()): PreparedShare {
  const file = workoutToShareFile(w, me);
  const { url, payload } = encodeShare(compactForLink(file, workoutFileSchema), baseUrl);
  return {
    kind: 'workout',
    name: file.name,
    version: file.version,
    file: jsonFile(file, workoutShareFileName(file.name, file.version)),
    url,
    payload,
    availability: shareAvailability(url.length),
  };
}

/** Piano → pannello. Le diete di solito superano le soglie: resta il file. */
export function prepareDietShare(plan: DietPlan, baseUrl: string = appBaseUrl()): PreparedShare {
  const file = dietToShareFile(plan);
  const { url, payload } = encodeShare(compactForLink(file, dietFileSchema), baseUrl);
  return {
    kind: 'diet',
    name: file.title,
    version: file.version,
    file: jsonFile(file, dietFileName(file.title)),
    url,
    payload,
    availability: shareAvailability(url.length),
  };
}
