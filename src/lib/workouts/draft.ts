import { newId, nowIso } from '../data/ids';
import type { Exercise } from '../data/schemas/exercises';
import type { DraftItem, DraftWarmup, WorkoutAuthor, WorkoutDraft } from '../data/schemas/workout-draft';
import type { Workout } from '../data/schemas/workouts';
import { move } from './calc/reorder';
import { NEW_ITEM } from './calc/values';

/** Chiave locale di una riga dell'editor (per `{#each}` e riordino): mai salvata nella scheda. */
export const newKey = (): string => newId();

/** Origine e autore di una scheda nuova: dall'ultima scelta fatta. */
export function newWorkoutOrigin(author: WorkoutAuthor): Pick<Workout, 'source' | 'author'> {
  return author.lastSource === 'pt' ? { source: 'pt', author: author.name.trim() } : { source: 'own', author: '' };
}

export function emptyDraft(author: WorkoutAuthor): WorkoutDraft {
  return {
    workoutId: newId(),
    baseVersion: null,
    ...newWorkoutOrigin(author),
    name: '',
    weekdays: [],
    time: null,
    intro: '',
    warmup: [],
    items: [],
    cardio: null,
  };
}

export function draftFromWorkout(w: Workout): WorkoutDraft {
  return {
    workoutId: w.id,
    baseVersion: w.version,
    source: w.source,
    author: w.author,
    name: w.name,
    weekdays: [...w.weekdays],
    time: w.time,
    intro: w.intro,
    warmup: w.warmup.map((x) => ({ key: newKey(), ...x })),
    items: w.items.map((item) => ({
      key: newKey(),
      exerciseId: item.exerciseId,
      name: item.name,
      muscles: [...item.muscles],
      sets: item.sets,
      reps: item.reps,
      kg: item.kg,
      restSec: item.restSec,
      note: item.note,
      videoUrl: item.videoUrl ?? '',
      setsDetail: item.setsDetail ? item.setsDetail.map((s) => ({ ...s })) : null,
      setsDetailMemory: null,
    })),
    cardio: w.cardio ? { ...w.cardio } : null,
  };
}

/** Riga nuova da un esercizio della libreria: 3 × 10, 0 kg, 90 s; nome, muscoli e video copiati. */
export function itemFromExercise(ex: Pick<Exercise, 'id' | 'name' | 'muscles' | 'videoUrl'>): DraftItem {
  return {
    key: newKey(),
    exerciseId: ex.id,
    name: ex.name,
    muscles: [...ex.muscles],
    ...NEW_ITEM,
    note: '',
    videoUrl: ex.videoUrl ?? '',
    setsDetail: null,
    setsDetailMemory: null,
  };
}

export function emptyWarmup(): DraftWarmup {
  return { key: newKey(), name: '', hint: '', dose: '' };
}

/**
 * Bozza → oggetto da validare come scheda (`workoutEditorSchema`). La versione vera
 * la decide il salvataggio (`prepareSave`); il link vuoto diventa `null`.
 */
export function draftToCandidate(d: WorkoutDraft, now: Date = new Date()): Record<string, unknown> {
  return {
    id: d.workoutId,
    version: d.baseVersion ?? 1,
    author: d.source === 'pt' ? d.author : '',
    source: d.source,
    name: d.name,
    weekdays: [...d.weekdays].sort((a, b) => a - b),
    time: d.time,
    intro: d.intro,
    warmup: d.warmup.map(({ name, hint, dose }) => ({ name, hint, dose })),
    items: d.items.map((item) => ({
      exerciseId: item.exerciseId,
      name: item.name,
      muscles: item.muscles,
      sets: item.sets,
      reps: item.reps,
      kg: item.kg,
      restSec: item.restSec,
      note: item.note,
      videoUrl: item.videoUrl.trim() === '' ? null : item.videoUrl.trim(),
      setsDetail: item.setsDetail,
    })),
    cardio: d.cardio,
    updatedAt: nowIso(now),
  };
}

/** Impronta del contenuto (senza chiavi locali né memoria): due bozze uguali = nessuna modifica. */
export function draftFingerprint(d: WorkoutDraft): string {
  const { updatedAt: _ignored, ...rest } = draftToCandidate(d, new Date(0));
  return JSON.stringify(rest);
}

// --- Operazioni sulle righe (restituiscono una bozza nuova) ---

export function moveItem(d: WorkoutDraft, from: number, to: number): WorkoutDraft {
  return { ...d, items: move(d.items, from, to) };
}

export function duplicateItem(d: WorkoutDraft, index: number): WorkoutDraft {
  const item = d.items[index];
  if (!item) return d;
  const copy: DraftItem = structuredClone({ ...item, key: newKey() });
  const items = d.items.slice();
  items.splice(index + 1, 0, copy);
  return { ...d, items };
}

export function removeItem(d: WorkoutDraft, index: number): WorkoutDraft {
  return { ...d, items: d.items.filter((_, i) => i !== index) };
}

export function updateItem(d: WorkoutDraft, index: number, patch: Partial<DraftItem>): WorkoutDraft {
  return { ...d, items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) };
}
