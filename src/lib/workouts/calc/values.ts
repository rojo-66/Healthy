import { MAX_ITEMS } from '../../data/limits';

/** Regole sui valori dell'editor (M4). Il database accetta di più: schede importate restano valide. */
export const SETS_MIN = 1;
export const SETS_MAX = MAX_ITEMS.setsPerItem;
export const REPS_MIN = 1;
export const REPS_MAX = 100;
export const KG_STEP = 2.5;
export const KG_MAX = 500;
export const REST_PRESETS = [60, 90, 120, 180] as const;
export const DEFAULT_REST = 90;
export const CARDIO_MIN_MIN = 1;
export const CARDIO_MAX_MIN = 180;
/** Minuti di un esercizio cardio appena aggiunto (come il vecchio "cardio finale"). */
export const NEW_CARDIO_MIN = 10;
/** Campi facoltativi del cardio nell'editor: etichetta, unità, passo, massimo, interi. */
export const CARDIO_FIELD_SPECS = {
  distance: { key: 'distanceKm', label: 'Distanza', unit: 'km', step: 0.5, max: 100, integer: false },
  speed: { key: 'speedKmh', label: 'Velocità', unit: 'km/h', step: 0.5, max: 40, integer: false },
  incline: { key: 'inclinePct', label: 'Pendenza', unit: '%', step: 0.5, max: 30, integer: false },
  level: { key: 'level', label: 'Livello', unit: '', step: 1, max: 40, integer: true },
} as const;
/** Valori scritti a mano oltre i quali lo Stepper chiede conferma (forse un errore di battitura). */
export const KG_CONFIRM_ABOVE = 250;
export const REPS_CONFIRM_ABOVE = 50;
export const CARDIO_CONFIRM_ABOVE = 120;

/** Valori di un esercizio appena aggiunto dalla libreria (come nel mockup). */
export const NEW_ITEM = { sets: 3, reps: 10, kg: 0, restSec: DEFAULT_REST } as const;

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export const clampSets = (n: number) => clampInt(n, SETS_MIN, SETS_MAX);
export const clampReps = (n: number) => clampInt(n, REPS_MIN, REPS_MAX);

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Kg dopo un tocco su − o +: passo 2,5 dal valore attuale, anche se scritto a mano fuori griglia
 * (20 → + 22,5; 22 → + 24,5 / − 19,5). Mai sotto 0 né sopra il massimo.
 */
export function kgStep(value: number, dir: 1 | -1): number {
  return round2(Math.min(KG_MAX, Math.max(0, value + dir * KG_STEP)));
}

export function isPresetRest(sec: number): boolean {
  return (REST_PRESETS as readonly number[]).includes(sec);
}

/** Pulsanti del recupero: i preset, più il valore attuale se arriva da una scheda importata (es. 75 s). */
export function restOptions(current: number): number[] {
  const options: number[] = [...REST_PRESETS];
  if (!isPresetRest(current)) options.push(current);
  return options.sort((a, b) => a - b);
}
