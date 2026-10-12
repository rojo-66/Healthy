import { workoutEditorSchema } from '../../workouts/calc/editor-schema';
import { duplicateWorkout, prepareSave, saveKind, type SaveKind } from '../../workouts/calc/version';
import { draftToCandidate } from '../../workouts/draft';
import { db } from '../db';
import { parseOrThrow, ValidationError } from '../errors';
import type { WorkoutDraft } from '../schemas/workout-draft';
import type { WorkoutFile } from '../schemas/workout-file';
import { workoutSchema, workoutVersionSchema, type Workout } from '../schemas/workouts';
import { nowIso } from '../ids';
import { MAX_ITEMS } from '../limits';
import { decideWorkoutImport, exerciseIndex, fileToWorkout, type WorkoutImportMode } from '../../share/import/workout';
import { getWorkoutAuthor, setWorkoutAuthor } from './settings';
import { createTableRepo } from './table-repo';

export const workoutsRepo = createTableRepo('workouts');

/** Schede dalla modificata più di recente. */
export function listWorkoutsRecent(): Promise<Workout[]> {
  return db.workouts.orderBy('updatedAt').reverse().toArray();
}

/** Schede assegnate a un giorno della settimana (1 = lunedì; indice multiEntry `*weekdays`). */
export function workoutsForWeekday(weekday: number): Promise<Workout[]> {
  return db.workouts.where('weekdays').equals(weekday).toArray();
}

export interface SavedWorkout {
  workout: Workout;
  kind: SaveKind;
  /** Versione prima del salvataggio (`null` per una scheda nuova o una copia). */
  from: number | null;
}

/**
 * Salva la bozza dell'editor (SPEC § 5.3): valida con le regole dell'editor, decide id e versione
 * (nuova v1 · mia v+1 · di un altro PT → mia copia v1), scrive e cancella la bozza, tutto in una transazione.
 * Errori → `ValidationError` con i messaggi in italiano, nessuna scrittura.
 */
export async function saveWorkout(draft: WorkoutDraft, now: Date = new Date()): Promise<SavedWorkout> {
  const candidate = parseOrThrow(workoutEditorSchema, draftToCandidate(draft, now));
  return db.transaction('rw', db.workouts, db.settings, async () => {
    const original = draft.baseVersion === null ? undefined : await db.workouts.get(draft.workoutId);
    const author = await getWorkoutAuthor();
    const kind = saveKind(original, author);
    const workout = parseOrThrow(workoutSchema, prepareSave(candidate, original, author, now));
    await db.workouts.put(workout);
    if (kind === 'new' && draft.source === 'pt' && author.name.trim() === '') {
      // L'origine predefinita si sceglie nel Profilo (M7). Il nome come PT, se manca, si ricorda
      // dalla prima scheda PT: serve a riconoscere le mie schede (stesso id, nuova versione).
      await setWorkoutAuthor({ name: draft.author, lastSource: author.lastSource });
    }
    await db.settings.delete('workoutDraft');
    return { workout, kind, from: kind === 'update' && original ? original.version : null };
  });
}

/** "Duplica": nuova scheda (nuovo id, v1, "… (copia)", senza giorni). */
export function duplicateWorkoutById(id: string, now: Date = new Date()): Promise<Workout> {
  return db.transaction('rw', db.workouts, db.settings, async () => {
    const original = await db.workouts.get(id);
    if (!original) throw new ValidationError([`Scheda non trovata.`]);
    const copy = parseOrThrow(workoutSchema, duplicateWorkout(original, await getWorkoutAuthor(), now));
    await db.workouts.add(copy);
    return copy;
  });
}

/** Elimina una scheda (e la sua bozza, se c'è). Le sessioni del M5 conservano il nome della scheda. */
export function deleteWorkout(id: string): Promise<void> {
  return db.transaction('rw', db.workouts, db.settings, async () => {
    await db.workouts.delete(id);
    const draft = await db.settings.get('workoutDraft');
    if (draft?.key === 'workoutDraft' && draft.value.draft.workoutId === id) await db.settings.delete('workoutDraft');
  });
}

export interface ImportedWorkout {
  workout: Workout;
  mode: WorkoutImportMode;
  /** Versione sostituita (solo per `replace`). */
  replaced: number | null;
}

/**
 * Salva una scheda ricevuta (M8) dopo l'anteprima. In una transazione: la decisione sulle versioni si
 * ricalcola sui dati del momento e, se la scelta non è più valida (es. la scheda è appena stata importata
 * da un'altra parte), non si scrive niente. "Sostituisci" sposta la versione attuale nella cronologia
 * (ultime `MAX_ITEMS.previousVersions`); le sessioni passate non cambiano (hanno la copia della scheda, M5).
 */
export function importWorkout(file: WorkoutFile, mode: WorkoutImportMode, now: Date = new Date()): Promise<ImportedWorkout> {
  return db.transaction('rw', db.workouts, db.exercises, async () => {
    const existing = await db.workouts.get(file.id);
    const decision = decideWorkoutImport(file, existing);
    if (!decision.actions.includes(mode)) {
      throw new ValidationError(['La scheda sul telefono è cambiata nel frattempo: riapri il link o il file e scegli di nuovo.']);
    }
    const library = exerciseIndex(await db.exercises.toArray());
    const incoming = fileToWorkout(file, library, mode, now);
    if (mode === 'replace' && existing) {
      incoming.previousVersions = [
        parseOrThrow(workoutVersionSchema, existing),
        ...existing.previousVersions,
      ].slice(0, MAX_ITEMS.previousVersions);
    }
    const workout = parseOrThrow(workoutSchema, incoming);
    await db.workouts.put(workout);
    return { workout, mode, replaced: mode === 'replace' && existing ? existing.version : null };
  });
}

/**
 * "Ripristina versione precedente": la versione scelta torna attuale, quella attuale entra nella cronologia
 * (così si può tornare indietro). `index` = posizione in `previousVersions` (0 = la più recente).
 */
export function restorePreviousVersion(id: string, index: number, now: Date = new Date()): Promise<Workout> {
  return db.transaction('rw', db.workouts, async () => {
    const current = await db.workouts.get(id);
    const target = current?.previousVersions[index];
    if (!current || !target) throw new ValidationError(['Versione non trovata: forse è già stata ripristinata.']);
    const others = current.previousVersions.filter((_, i) => i !== index);
    const restored = parseOrThrow(workoutSchema, {
      ...target,
      id: current.id,
      updatedAt: nowIso(now),
      previousVersions: [parseOrThrow(workoutVersionSchema, current), ...others].slice(0, MAX_ITEMS.previousVersions),
    });
    await db.workouts.put(restored);
    return restored;
  });
}
