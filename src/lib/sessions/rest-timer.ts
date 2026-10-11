import type { RestTimer } from '../data/schemas/sessions';

/**
 * Recupero basato su istanti (SPEC § 5.4). Niente contatori decrementati da `setInterval`:
 * se iOS rallenta o sospende la pagina, al ritorno il tempo rimasto si ricalcola dall'istante di fine.
 * `now` è in millisecondi (`Date.now()`); `null` = nessun recupero.
 */

export const REST_PRESETS = [60, 90, 120, 180] as const;
export const REST_STEP_SEC = 15;
/** Massimo dello schema (`totalSec`). */
const MAX_SEC = 3600;

const iso = (ms: number) => new Date(ms).toISOString();
const clampSec = (sec: number) => Math.min(MAX_SEC, Math.max(0, Math.round(sec)));

/** Parte un recupero di `totalSec` secondi. */
export function startRest(totalSec: number, now: number): RestTimer {
  const sec = clampSec(totalSec);
  return { totalSec: sec, endsAt: iso(now + sec * 1000), pausedRemainingMs: null };
}

export function isPaused(t: RestTimer | null): boolean {
  return t !== null && t.endsAt === null && t.pausedRemainingMs !== null;
}

/** Millisecondi rimasti all'istante `now` (0 se finito o assente). */
export function remainingMs(t: RestTimer | null, now: number): number {
  if (!t) return 0;
  if (t.endsAt === null) return Math.max(0, t.pausedRemainingMs ?? 0);
  return Math.max(0, Date.parse(t.endsAt) - now);
}

/** Secondi rimasti, arrotondati per eccesso (01:30 finché non scatta 01:29). */
export function remainingSec(t: RestTimer | null, now: number): number {
  return Math.ceil(remainingMs(t, now) / 1000);
}

/** In corso (non in pausa) e arrivato a zero. */
export function isFinished(t: RestTimer | null, now: number): boolean {
  return t !== null && !isPaused(t) && remainingMs(t, now) === 0;
}

/** Parte del recupero che resta (1 = appena partito, 0 = finito): riempimento del cerchio. */
export function restFraction(t: RestTimer | null, now: number): number {
  if (!t || t.totalSec <= 0) return 0;
  return Math.min(1, remainingMs(t, now) / (t.totalSec * 1000));
}

export function pauseRest(t: RestTimer | null, now: number): RestTimer | null {
  if (!t || isPaused(t)) return t;
  return { ...t, endsAt: null, pausedRemainingMs: Math.round(remainingMs(t, now)) };
}

export function resumeRest(t: RestTimer | null, now: number): RestTimer | null {
  if (!t || !isPaused(t)) return t;
  return { ...t, endsAt: iso(now + (t.pausedRemainingMs ?? 0)), pausedRemainingMs: null };
}

/** ±15 s (o altro): non scende sotto zero; se supera la durata di partenza, la durata cresce. Senza recupero, + ne avvia uno. */
export function adjustRest(t: RestTimer | null, deltaSec: number, now: number): RestTimer | null {
  if (!t) return deltaSec > 0 ? startRest(deltaSec, now) : null;
  const left = Math.min(MAX_SEC * 1000, Math.max(0, remainingMs(t, now) + deltaSec * 1000));
  const totalSec = Math.max(t.totalSec, Math.ceil(left / 1000));
  return isPaused(t)
    ? { totalSec, endsAt: null, pausedRemainingMs: Math.round(left) }
    : { totalSec, endsAt: iso(now + left), pausedRemainingMs: null };
}

/** "Salta": nessun recupero. */
export function skipRest(): null {
  return null;
}
