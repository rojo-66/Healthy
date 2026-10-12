import { newId, nowIso } from '../../data/ids';
import type { Exercise } from '../../data/schemas/exercises';
import type { WorkoutFile } from '../../data/schemas/workout-file';
import type { Workout } from '../../data/schemas/workouts';
import { copyName } from '../../workouts/calc/version';
import { normalize } from '../../workouts/library/search';
import { contentHash } from '../canonical';

/**
 * Come salvare una scheda ricevuta:
 * - `new`: non c'è una scheda con lo stesso `id`;
 * - `replace`: sostituisce la mia (stesso `id`), la precedente va nella cronologia;
 * - `copy`: nuova scheda (nuovo `id`, nome "… (copia)", stesso autore).
 */
export type WorkoutImportMode = 'new' | 'replace' | 'copy';

/** Confronto con la scheda che ho già: id nuovo, versione in arrivo maggiore, uguale o minore. */
export type WorkoutImportStatus = 'new' | 'newer' | 'same' | 'older';

export interface WorkoutImportDecision {
  status: WorkoutImportStatus;
  existing: Workout | null;
  /** La mia scheda ricevuta è stata modificata qui dopo l'import: "Sostituisci" perderebbe le modifiche. */
  localEdits: boolean;
  /** Versione con cui si confronta: quella ricevuta, se la scheda è stata modificata qui; altrimenti la mia. */
  base: number | null;
  actions: readonly WorkoutImportMode[];
  defaultAction: WorkoutImportMode;
}

/**
 * Modificata qui dopo l'import: è ricevuta e la versione o il contenuto non sono più quelli dell'import.
 * (Le schede di un altro non si modificano mai sul posto, M4: diventano una mia copia. Succede solo con
 * una scheda ricevuta che risulta mia, cioè con il mio nome come autore.)
 */
export function isLocallyEdited(w: Workout): boolean {
  if (!w.received) return false;
  return w.version !== w.received.version || contentHash(w) !== w.received.hash;
}

/**
 * Matrice delle versioni (SPEC § 8.4). Chiave: `id` + `version`.
 * Se la mia scheda è stata modificata qui, le mie modifiche possono aver già "consumato" il numero di versione
 * (la mia v4 locale contro la v4 del PT): si confronta con la versione ricevuta, non con la mia.
 */
export function decideWorkoutImport(file: Pick<WorkoutFile, 'version'>, existing: Workout | undefined | null): WorkoutImportDecision {
  if (!existing) return { status: 'new', existing: null, localEdits: false, base: null, actions: ['new'], defaultAction: 'new' };
  const localEdits = isLocallyEdited(existing);
  const base = localEdits && existing.received ? existing.received.version : existing.version;
  const status: WorkoutImportStatus = file.version > base ? 'newer' : file.version === base ? 'same' : 'older';
  if (status === 'newer') {
    return { status, existing, localEdits, base, actions: ['replace', 'copy'], defaultAction: localEdits ? 'copy' : 'replace' };
  }
  return { status, existing, localEdits, base, actions: ['copy'], defaultAction: 'copy' };
}

/** Collegamento alla libreria per nome (maiuscole, accenti e spazi non contano); `null` se non c'è. */
export function exerciseIndex(exercises: readonly Pick<Exercise, 'id' | 'name'>[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const ex of exercises) {
    const key = normalize(ex.name);
    if (!map.has(key)) map.set(key, ex.id);
  }
  return map;
}

/**
 * File ricevuto → scheda da salvare. Tiene `id`, versione, autore e origine di chi l'ha mandata;
 * `received` ricorda versione e impronta del contenuto (per riconoscere modifiche fatte qui).
 */
export function fileToWorkout(
  file: WorkoutFile,
  library: ReadonlyMap<string, string>,
  mode: 'new' | 'replace' | 'copy',
  now: Date = new Date(),
): Workout {
  const workout: Workout = {
    id: mode === 'copy' ? newId() : file.id,
    version: file.version,
    author: file.author,
    source: file.source,
    name: mode === 'copy' ? copyName(file.name) : file.name,
    weekdays: [...file.weekdays].sort((a, b) => a - b),
    time: file.time,
    intro: file.intro,
    warmup: file.warmup.map((w) => ({ name: w.name, hint: w.hint, dose: w.dose })),
    items: file.items.map((item) => ({
      exerciseId: library.get(normalize(item.name)) ?? null,
      name: item.name,
      muscles: [...item.muscles],
      sets: item.sets,
      reps: item.reps,
      kg: item.kg,
      restSec: item.restSec,
      note: item.note,
      videoUrl: item.videoUrl,
      setsDetail: item.setsDetail ? item.setsDetail.map((s) => ({ reps: s.reps, kg: s.kg })) : null,
    })),
    cardio: file.cardio ? { type: file.cardio.type, minutes: file.cardio.minutes } : null,
    updatedAt: nowIso(now),
    received: null,
    previousVersions: [],
  };
  // Impronta della scheda così come viene salvata (per una copia anche il nome nuovo).
  workout.received = { version: file.version, hash: contentHash(workout), at: nowIso(now) };
  return workout;
}
