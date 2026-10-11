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
