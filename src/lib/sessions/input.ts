import { formatNumber } from '../components/stepper';

/** Limiti dello schema (`kgSchema`, `repsSchema`). */
export const KG_MAX = 1000;
export const REPS_MAX = 1000;

/**
 * Kg scritti a mano con la tastiera decimale di iPhone: "57,5" o "57.5".
 * `null` se non è un numero valido (il campo torna al valore precedente). Due decimali al massimo.
 */
export function parseKg(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!/^\d{1,4}(\.\d*)?$|^\.\d+$/.test(clean)) return null;
  const n = Number(clean);
  if (!Number.isFinite(n) || n > KG_MAX) return null;
  return Math.round(n * 100) / 100;
}

/** Ripetizioni: intero tra 0 e 1000; `null` se non valido. */
export function parseReps(text: string): number | null {
  const clean = text.trim();
  if (!/^\d{1,4}$/.test(clean)) return null;
  const n = Number(clean);
  return n <= REPS_MAX ? n : null;
}

/** Valore da mostrare nel campo kg: "57,5" (senza separatore delle migliaia). */
export function kgInputValue(kg: number): string {
  return formatNumber(kg).replace(/\./g, '');
}

/**
 * Minuti o km effettivi del cardio (2a), scritti a mano: "18", "2,9" o "2.9". Campo vuoto = `null`
 * (non scritto); `undefined` = testo non valido o oltre `max` (il valore salvato resta quello di prima).
 */
export function parseOptional(text: string, max: number): number | null | undefined {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  if (!/^\d{1,4}(\.\d*)?$|^\.\d+$/.test(clean)) return undefined;
  const n = Number(clean);
  if (!Number.isFinite(n) || n > max) return undefined;
  return Math.round(n * 100) / 100;
}

/** Valore da mostrare in un campo facoltativo: "2,9"; `null` → "". */
export function optionalInputValue(value: number | null): string {
  return value === null ? '' : kgInputValue(value);
}
