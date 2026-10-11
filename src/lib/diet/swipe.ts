/**
 * Swipe tra i giorni (§ 4): il contenuto segue il dito, al rilascio passa al giorno vicino o torna a posto.
 * Logica pura, come `components/sheet-gesture.ts`.
 */

/** Spostamento minimo prima di decidere se il gesto è orizzontale (swipe) o verticale (scroll). */
export const AXIS_LOCK_PX = 10;
/** Velocità (px/ms) oltre la quale anche un gesto corto cambia giorno. */
export const FLICK_VELOCITY = 0.5;
const FLICK_MIN_PX = 24;
/** Resistenza oltre il primo/ultimo giorno. */
const EDGE_RESISTANCE = 0.25;

/** `true` = orizzontale, `false` = verticale, `null` = ancora troppo poco per dirlo. */
export function lockAxis(dx: number, dy: number): boolean | null {
  if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2;
}

/** Spostamento mostrato: pieno, ma con resistenza se non c'è un giorno in quella direzione. */
export function swipeOffset(dx: number, hasPrevious: boolean, hasNext: boolean): number {
  if ((dx > 0 && !hasPrevious) || (dx < 0 && !hasNext)) return dx * EDGE_RESISTANCE;
  return dx;
}

/**
 * Giorno da raggiungere al rilascio: −1 = precedente (dito verso destra), +1 = successivo, 0 = resta.
 * Basta superare 1/4 della larghezza o un colpo veloce.
 */
export function swipeDecision(dx: number, velocity: number, width: number, hasPrevious: boolean, hasNext: boolean): -1 | 0 | 1 {
  const far = Math.abs(dx) > width / 4;
  const flick = Math.abs(velocity) > FLICK_VELOCITY && Math.abs(dx) > FLICK_MIN_PX && Math.sign(velocity) === Math.sign(dx);
  if (!far && !flick) return 0;
  if (dx > 0) return hasPrevious ? -1 : 0;
  return hasNext ? 1 : 0;
}
