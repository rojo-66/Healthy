/**
 * Scale "belle" per i grafici (SPEC § 5.7): passi 0,1 · 0,2 · 0,25 · 0,5 · 1 · 2 · 2,5 · 5 · 10 …,
 * tra 4 e 6 tacche, con un margine del 12 % attorno ai dati. Un solo asse per grafico.
 * - Le linee non partono da zero (si vede la variazione); le barre sì (`zero: true`).
 * - Valori tutti uguali o un solo punto danno comunque una scala non nulla: mai NaN né infinito.
 */

export interface Scale {
  lo: number;
  hi: number;
  step: number;
  ticks: number[];
}

const MANTISSAS = [1, 2, 2.5, 5];
const STEPS: number[] = [];
for (let exp = -1; exp <= 6; exp++) for (const m of MANTISSAS) STEPS.push(round(m * 10 ** exp));

const MARGIN = 0.12;
const MIN_SPAN = 0.2;

function round(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

function finite(values: readonly number[]): number[] {
  return values.filter((v) => Number.isFinite(v));
}

function build(lo: number, hi: number, step: number): Scale {
  const first = Math.floor(round(lo / step));
  const last = Math.ceil(round(hi / step));
  const ticks: number[] = [];
  for (let i = first; i <= last; i++) ticks.push(round(i * step));
  return { lo: round(first * step), hi: round(last * step), step, ticks };
}

/** Scala per i valori dati; `zero` la fa partire da 0 (barre), `integer` usa solo passi interi (conteggi). */
export function niceScale(values: readonly number[], options: { zero?: boolean; integer?: boolean } = {}): Scale {
  const list = finite(values);
  let min = list.length ? Math.min(...list) : 0;
  let max = list.length ? Math.max(...list) : 0;
  if (options.zero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (max - min < 1e-9) {
    // Tutti uguali (o un punto solo): un intervallo piccolo ma visibile attorno al valore.
    const pad = Math.max(Math.abs(max) * 0.02, 0.5);
    if (options.zero && min === 0) max = max === 0 ? 1 : max + pad;
    else {
      min -= pad;
      max += pad;
    }
  }
  if (max - min < MIN_SPAN) {
    // Più stretto del passo minimo (0,1): si allarga attorno ai dati, così restano almeno 3 tacche.
    const pad = (MIN_SPAN - (max - min)) / 2;
    if (options.zero && min === 0) max = MIN_SPAN;
    else {
      min -= pad;
      max += pad;
    }
  }
  const span = max - min;
  const lo = options.zero && min >= 0 ? 0 : min - span * MARGIN;
  const hi = max + span * MARGIN;

  let fallback: Scale | null = null;
  let best: Scale | null = null;
  for (const step of STEPS) {
    if (options.integer && !Number.isInteger(step)) continue;
    const scale = build(lo, hi, step);
    const intervals = scale.ticks.length - 1;
    if (intervals > 5) continue;
    fallback ??= scale;
    if (intervals >= 3) {
      best = scale;
      break;
    }
  }
  return best ?? fallback ?? build(lo, hi, STEPS[STEPS.length - 1] ?? 1);
}

/** Scala simmetrica per le barre divergenti (%): almeno ±10, a passi di 5. Tacche: +L, 0, −L. */
export function divergingScale(values: readonly number[]): Scale {
  const list = finite(values);
  const maxAbs = list.length ? Math.max(...list.map(Math.abs)) : 0;
  const limit = Math.max(10, Math.ceil((maxAbs * (1 + MARGIN)) / 5) * 5);
  return { lo: -limit, hi: limit, step: limit, ticks: [limit, 0, -limit] };
}

/** Posizione verticale di un valore (0 = in alto) in un'area alta `height`. */
export function scaleY(scale: Pick<Scale, 'lo' | 'hi'>, value: number, top: number, height: number): number {
  const span = scale.hi - scale.lo || 1;
  return top + ((scale.hi - value) / span) * height;
}
