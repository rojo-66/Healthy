export interface StepOptions {
  min: number;
  max: number;
  step: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function decimals(n: number): number {
  const s = String(n);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/** Valore dopo un tocco su − (dir = -1) o + (dir = 1): resta nei limiti e senza errori di virgola mobile. */
export function stepValue(value: number, dir: 1 | -1, { min, max, step }: StepOptions): number {
  const factor = 10 ** Math.max(decimals(step), decimals(value));
  const next = Math.round((value + dir * step) * factor) / factor;
  return clamp(next, min, max);
}

/** Il pulsante − (dir = -1) o + (dir = 1) ha ancora effetto? */
export function canStep(value: number, dir: 1 | -1, opts: StepOptions): boolean {
  return dir === 1 ? value < opts.max : value > opts.min;
}

const itNumber = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

/** Numero all'italiana: 72,5 */
export function formatNumber(n: number): string {
  return itNumber.format(n);
}
