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

/**
 * Valore dopo un tocco su − (dir = -1) o + (dir = 1): resta nei limiti e senza errori di virgola mobile.
 * Prosegue dal valore attuale anche se non è un multiplo del passo (22 + 2,5 = 24,5).
 */
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

// --- Numero scritto a mano ---

/** Numero scritto sulla tastiera: accetta virgola o punto e spazi ai lati; `null` se non è un numero. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface TypedOptions {
  min: number;
  max: number;
  /** Solo numeri interi (serie, ripetizioni, minuti). */
  integer: boolean;
  /** Oltre questo valore si chiede conferma (es. 250 kg: forse un errore di battitura). */
  confirmAbove?: number | undefined;
}

export type TypedResult =
  | { kind: 'ok'; value: number }
  | { kind: 'confirm'; value: number }
  | { kind: 'invalid' }
  | { kind: 'not-integer' }
  | { kind: 'out-of-range' };

/**
 * Esito di un numero scritto nello Stepper. Il valore NON viene agganciato al passo (22 kg resta 22);
 * i decimali si fermano a due.
 */
export function readTyped(text: string, opts: TypedOptions): TypedResult {
  const n = parseNumber(text);
  if (n === null) return { kind: 'invalid' };
  if (opts.integer && !Number.isInteger(n)) return { kind: 'not-integer' };
  const value = Math.round(n * 100) / 100;
  if (value < opts.min || value > opts.max) return { kind: 'out-of-range' };
  if (opts.confirmAbove !== undefined && value > opts.confirmAbove) return { kind: 'confirm', value };
  return { kind: 'ok', value };
}

/** Messaggio per l'avviso sotto lo Stepper (testo, mai HTML). */
export function typedMessage(result: TypedResult, opts: { min: number; max: number; unit?: string | undefined }): string {
  const unit = opts.unit ? ` ${opts.unit}` : '';
  switch (result.kind) {
    case 'invalid':
      return 'Scrivi un numero.';
    case 'not-integer':
      return 'Solo numeri interi.';
    case 'out-of-range':
      return `Valore tra ${formatNumber(opts.min)} e ${formatNumber(opts.max)}${unit}.`;
    default:
      return '';
  }
}

// --- Pressione lunga: ripetizione che accelera ---

/** Attesa prima della prima ripetizione (ms): sotto, è un tocco normale. */
export const REPEAT_HOLD_MS = 400;
const REPEAT_FIRST_MS = 180;
const REPEAT_MIN_MS = 40;
const REPEAT_FACTOR = 0.82;

/** Attesa prima della ripetizione n (0 = la prima, dopo la pressione lunga): sempre più breve. */
export function repeatDelay(n: number): number {
  if (n <= 0) return REPEAT_HOLD_MS;
  return Math.max(REPEAT_MIN_MS, Math.round(REPEAT_FIRST_MS * REPEAT_FACTOR ** (n - 1)));
}

export interface Repeater {
  /** Pressione iniziata: dopo `REPEAT_HOLD_MS` parte la ripetizione. */
  start(): void;
  /** Pressione finita: `true` se c'è stata almeno una ripetizione (il click che segue va ignorato). */
  stop(): boolean;
}

/**
 * Ripetizione della pressione lunga. `step` fa un passo e dice se se ne può fare un altro
 * (al limite la ripetizione si ferma da sola). Usa `setTimeout`: nei test l'orologio è simulato.
 */
export function createRepeater(step: () => boolean): Repeater {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let count = 0;

  function run() {
    timer = undefined;
    const more = step();
    count += 1;
    if (more) timer = setTimeout(run, repeatDelay(count));
  }

  return {
    start() {
      clearTimeout(timer);
      count = 0;
      timer = setTimeout(run, repeatDelay(0));
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
      const repeated = count > 0;
      count = 0;
      return repeated;
    },
  };
}
