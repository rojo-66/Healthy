/**
 * Swipe orizzontali (SPEC § 4): giorni, esercizi della sessione, tab, righe, indietro dal bordo.
 * Logica pura (testata in `tests/unit/swipe.test.ts`); gli eventi del puntatore sono in `swipe-action.ts`.
 *
 * Direzione: −1 = precedente (il dito va verso destra), +1 = successivo (il dito va verso sinistra).
 */

export type SwipeDir = -1 | 1;

/** Spostamento minimo prima di decidere se il gesto è orizzontale (swipe) o verticale (scroll). */
export const AXIS_LOCK_PX = 10;
/** Velocità (px/ms) oltre la quale anche un gesto corto conta. */
export const FLICK_VELOCITY = 0.5;
const FLICK_MIN_PX = 24;
/** Resistenza quando in quella direzione non c'è niente. */
const EDGE_RESISTANCE = 0.25;
/**
 * Fascia (px) sui bordi dello schermo: da sinistra parte lo swipe indietro, sui due bordi gli swipe
 * del contenuto non partono (niente conflitti con i gesti di sistema).
 */
export const EDGE_PX = 24;

/** `true` = orizzontale, `false` = verticale, `null` = ancora troppo poco per dirlo. */
export function lockAxis(dx: number, dy: number): boolean | null {
  if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2;
}

/** Direzione di un trascinamento orizzontale. */
export function dirOf(dx: number): SwipeDir {
  return dx > 0 ? -1 : 1;
}

/** Il tocco parte vicino a un bordo dello schermo? */
export function nearEdge(x: number, width: number, edge = EDGE_PX): boolean {
  return x <= edge || x >= width - edge;
}

/** Spostamento mostrato: pieno, ma con resistenza se non c'è niente in quella direzione. */
export function swipeOffset(dx: number, canPrevious: boolean, canNext: boolean): number {
  if ((dx > 0 && !canPrevious) || (dx < 0 && !canNext)) return dx * EDGE_RESISTANCE;
  return dx;
}

/**
 * Dove andare al rilascio: −1 = precedente, +1 = successivo, 0 = resta.
 * Basta superare 1/4 della larghezza o un colpo veloce nella stessa direzione.
 */
export function swipeDecision(dx: number, velocity: number, width: number, canPrevious: boolean, canNext: boolean): -1 | 0 | 1 {
  const far = Math.abs(dx) > width / 4;
  const flick = Math.abs(velocity) > FLICK_VELOCITY && Math.abs(dx) > FLICK_MIN_PX && Math.sign(velocity) === Math.sign(dx);
  if (!far && !flick) return 0;
  if (dx > 0) return canPrevious ? -1 : 0;
  return canNext ? 1 : 0;
}

/**
 * Zone annidate (es. giorni dentro le tab): al blocco dell'asse vince la zona più interna che gestisce
 * quella direzione. `zones` va dalla più interna alla più esterna.
 */
export function pickZone<Z>(zones: readonly Z[], dir: SwipeDir, claims: (zone: Z, dir: SwipeDir) => boolean): Z | null {
  return zones.find((z) => claims(z, dir)) ?? null;
}

/** Azioni di una riga (es. Duplica/Elimina): aperta o chiusa al rilascio, `width` = larghezza delle azioni. */
export function revealDecision(offset: number, velocity: number, width: number): boolean {
  if (velocity < -FLICK_VELOCITY) return true;
  if (velocity > FLICK_VELOCITY) return false;
  return offset < -width / 2;
}

/** Posizione della riga mentre si trascina: tra chiusa (0) e aperta (−width), con un po' di elasticità oltre. */
export function revealOffset(dx: number, open: boolean, width: number): number {
  const raw = (open ? -width : 0) + dx;
  if (raw > 0) return raw * EDGE_RESISTANCE;
  if (raw < -width) return -width + (raw + width) * EDGE_RESISTANCE;
  return raw;
}
