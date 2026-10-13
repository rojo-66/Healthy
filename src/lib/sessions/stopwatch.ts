import type { Stopwatch } from '../data/schemas/sessions';

/**
 * Cronometro del cardio (2a), basato su istanti come il recupero (`rest-timer.ts`): niente contatori
 * incrementati da `setInterval`. Se iOS sospende la pagina, al ritorno il tempo si ricalcola dall'istante di partenza.
 * Sale senza fermarsi: arrivato al tempo previsto avvisa, ma continua.
 */

export const STOPPED: Stopwatch = { runningSince: null, elapsedMs: 0 };

/** Massimo dello schema (24 ore). */
const MAX_MS = 24 * 3_600_000;

const iso = (ms: number) => new Date(ms).toISOString();

export function isRunning(c: Stopwatch): boolean {
  return c.runningSince !== null;
}

/** Tempo trascorso all'istante `now` (ms). */
export function elapsedMs(c: Stopwatch, now: number): number {
  const running = c.runningSince === null ? 0 : Math.max(0, now - Date.parse(c.runningSince));
  return Math.min(MAX_MS, c.elapsedMs + running);
}

/** Avvia (o riprende) il cronometro. */
export function startClock(c: Stopwatch, now: number): Stopwatch {
  if (isRunning(c)) return c;
  return { runningSince: iso(now), elapsedMs: c.elapsedMs };
}

/** Mette in pausa: il tempo trascorso resta. */
export function pauseClock(c: Stopwatch, now: number): Stopwatch {
  if (!isRunning(c)) return c;
  return { runningSince: null, elapsedMs: Math.round(elapsedMs(c, now)) };
}

/** Azzera (fermo, a zero). */
export function resetClock(): Stopwatch {
  return { ...STOPPED };
}

/** Il tempo previsto (minuti) è stato raggiunto? Mai con un tempo previsto di 0. */
export function reachedTarget(c: Stopwatch, targetMin: number, now: number): boolean {
  return targetMin > 0 && elapsedMs(c, now) >= targetMin * 60_000;
}

/**
 * L'avviso del tempo previsto va dato adesso? Solo se il traguardo è stato superato tra `prevNow` e `now`
 * mentre la pagina era visibile e il controllo è stato fatto da poco (al ritorno da una sospensione
 * lunga niente suono in ritardo, come per il recupero).
 */
export function crossedTarget(c: Stopwatch, targetMin: number, prevNow: number, now: number, maxGapMs = 3000): boolean {
  if (!isRunning(c) || targetMin <= 0 || now - prevNow > maxGapMs) return false;
  return !reachedTarget(c, targetMin, prevNow) && reachedTarget(c, targetMin, now);
}

/** Minuti interi trascorsi, arrotondati (almeno 1 se il cronometro è partito). */
export function elapsedMinutes(c: Stopwatch, now: number): number {
  const ms = elapsedMs(c, now);
  return ms <= 0 ? 0 : Math.max(1, Math.round(ms / 60_000));
}
