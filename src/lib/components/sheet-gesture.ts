/** Frazione dell'altezza del pannello oltre la quale il trascinamento lo chiude. */
export const DISMISS_FRACTION = 0.25;
/** Velocità verso il basso (px/ms) che chiude anche con uno spostamento breve. */
export const DISMISS_VELOCITY = 0.5;
const MIN_FLICK_PX = 24;

/** Spostamento del pannello mentre il dito trascina: verso l'alto non va oltre la posizione aperta. */
export function dragOffset(dy: number): number {
  return Math.max(0, dy);
}

/** Al rilascio: chiudere (true) o tornare su a molla (false)? */
export function shouldDismiss(dy: number, velocity: number, height: number): boolean {
  if (dy <= 0) return false;
  if (height > 0 && dy >= height * DISMISS_FRACTION) return true;
  return velocity >= DISMISS_VELOCITY && dy >= MIN_FLICK_PX;
}
