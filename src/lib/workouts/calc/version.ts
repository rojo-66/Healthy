import { newId, nowIso } from '../../data/ids';
import { MAX_TEXT } from '../../data/limits';
import type { WorkoutAuthor } from '../../data/schemas/workout-draft';
import { versionSchema } from '../../data/schemas/workouts';
import type { Workout } from '../../data/schemas/workouts';
import { newWorkoutOrigin } from '../draft';
import { normalize } from '../library/search';

/**
 * Cosa fa il salvataggio:
 * - `new`: scheda nuova → v1;
 * - `update`: scheda mia (TUA, o PT scritta da me) → stesso id, versione + 1;
 * - `copy`: scheda ricevuta da un altro PT → mia copia (nuovo id, v1, TUA); l'originale resta aggiornabile (M8).
 */
export type SaveKind = 'new' | 'update' | 'copy';

/** La scheda è mia? TUA sempre; PT solo se l'autore è il nome che ho impostato. */
export function isOwnWorkout(w: Pick<Workout, 'source' | 'author'>, author: WorkoutAuthor): boolean {
  if (w.source === 'own') return true;
  const me = normalize(author.name);
  return me !== '' && normalize(w.author) === me;
}

export function saveKind(original: Workout | undefined, author: WorkoutAuthor): SaveKind {
  if (!original) return 'new';
  return isOwnWorkout(original, author) ? 'update' : 'copy';
}

const MAX_VERSION = versionSchema.maxValue ?? 100000;

/** Versione dopo il salvataggio, per il badge "v3 → v4". */
export function versionAfterSave(original: Workout | undefined, author: WorkoutAuthor): number {
  const kind = saveKind(original, author);
  return kind === 'update' && original ? Math.min(MAX_VERSION, original.version + 1) : 1;
}

/** Scheda da scrivere: `candidate` è già valida (`workoutEditorSchema`); qui si decidono id, versione e origine. */
export function prepareSave(
  candidate: Workout,
  original: Workout | undefined,
  author: WorkoutAuthor,
  now: Date = new Date(),
): Workout {
  const updatedAt = nowIso(now);
  switch (saveKind(original, author)) {
    case 'new':
      return { ...candidate, version: 1, updatedAt };
    case 'update':
      return { ...candidate, id: original!.id, version: versionAfterSave(original, author), updatedAt };
    case 'copy':
      return { ...candidate, id: newId(), version: 1, source: 'own', author: '', updatedAt };
  }
}

const COPY_SUFFIX = ' (copia)';

/** "Gambe" → "Gambe (copia)", senza superare la lunghezza massima del nome. */
export function copyName(name: string): string {
  const base = name.trim().slice(0, MAX_TEXT.name - COPY_SUFFIX.length).trimEnd();
  return base + COPY_SUFFIX;
}

/**
 * "Duplica": nuovo id, v1, nome "… (copia)", origine come una scheda nuova.
 * I giorni non si copiano: due schede uguali nello stesso giorno confonderebbero la settimana.
 */
export function duplicateWorkout(w: Workout, author: WorkoutAuthor, now: Date = new Date()): Workout {
  return {
    ...structuredClone(w),
    id: newId(),
    version: 1,
    ...newWorkoutOrigin(author),
    name: copyName(w.name),
    weekdays: [],
    updatedAt: nowIso(now),
  };
}
