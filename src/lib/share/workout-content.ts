import { fnv1a } from '../hash';

/**
 * Contenuto condivisibile di una scheda (lista bianca, SPEC § 8.4) e sua impronta. Modulo leggero, senza
 * dipendenze dal database: lo usano la condivisione e le migrazioni dei dati (`data/migrations/cardio.ts`).
 */

export interface ShareableStrengthItem {
  kind: 'strength';
  name: string;
  muscles: readonly string[];
  sets: number;
  reps: number;
  kg: number;
  restSec: number;
  note: string;
  videoUrl: string | null;
  setsDetail: readonly { reps: number; kg: number }[] | null;
}

export interface ShareableCardioItem {
  kind: 'cardio';
  name: string;
  minutes: number;
  distanceKm: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
  level: number | null;
  note: string;
  videoUrl: string | null;
}

/** Ciò che una scheda contiene davvero (stesso calcolo per una scheda salvata e per un file ricevuto). */
export interface ShareableWorkoutContent {
  name: string;
  weekdays: readonly number[];
  time: string | null;
  intro: string;
  warmup: readonly { name: string; hint: string; dose: string }[];
  items: readonly (ShareableStrengthItem | ShareableCardioItem)[];
}

function shareableItem(i: ShareableStrengthItem | ShareableCardioItem): ShareableStrengthItem | ShareableCardioItem {
  if (i.kind === 'cardio') {
    return {
      kind: 'cardio',
      name: i.name,
      minutes: i.minutes,
      distanceKm: i.distanceKm,
      speedKmh: i.speedKmh,
      inclinePct: i.inclinePct,
      level: i.level,
      note: i.note,
      videoUrl: i.videoUrl,
    };
  }
  return {
    kind: 'strength',
    name: i.name,
    muscles: [...i.muscles],
    sets: i.sets,
    reps: i.reps,
    kg: i.kg,
    restSec: i.restSec,
    note: i.note,
    videoUrl: i.videoUrl,
    setsDetail: i.setsDetail ? i.setsDetail.map((s) => ({ reps: s.reps, kg: s.kg })) : null,
  };
}

/** Contenuto della scheda, campo per campo (lista bianca). */
export function shareableContent(w: ShareableWorkoutContent): ShareableWorkoutContent {
  return {
    name: w.name,
    weekdays: [...w.weekdays].sort((a, b) => a - b),
    time: w.time,
    intro: w.intro,
    warmup: w.warmup.map((x) => ({ name: x.name, hint: x.hint, dose: x.dose })),
    items: w.items.map(shareableItem),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
  return out;
}

/** JSON canonico: chiavi in ordine alfabetico a ogni livello, nessuno spazio. Stesso contenuto → stesso testo. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/** Impronta esadecimale a 8 cifre di un valore qualunque (JSON canonico). */
export function hashOf(value: unknown): string {
  return fnv1a(canonicalJson(value)).toString(16).padStart(8, '0');
}

/** Impronta del contenuto di una scheda (8 cifre esadecimali): rileva le modifiche fatte dopo l'import. */
export function contentHash(w: ShareableWorkoutContent): string {
  return hashOf(shareableContent(w));
}
