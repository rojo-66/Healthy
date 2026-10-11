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
export const CARDIO_MAX_MIN = 180;

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
 * Kg dopo un tocco su − o +: passo 2,5 agganciato alla griglia dei dischi
 * (22 → + 22,5 / − 20; 22,5 → + 25 / − 20). Mai sotto 0 né sopra il massimo.
 */
export function kgStep(value: number, dir: 1 | -1): number {
  const grid = value / KG_STEP;
  const eps = 1e-9;
  const next = dir === 1 ? (Math.floor(grid + eps) + 1) * KG_STEP : (Math.ceil(grid - eps) - 1) * KG_STEP;
  return round2(Math.min(KG_MAX, Math.max(0, next)));
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
