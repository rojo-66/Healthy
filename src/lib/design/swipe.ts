/**
 * Swipe orizzontali (SPEC § 4): giorni, esercizi della sessione, tab, righe, indietro dal bordo.
 * Logica pura (testata in `tests/unit/swipe.test.ts`); gli eventi del puntatore sono in `swipe-action.ts`.
 *
 * Direzione: −1 = precedente (il dito va verso destra), +1 = successivo (il dito va verso sinistra).
 */

export type SwipeDir = -1 | 1;

/**
 * Spostamento minimo prima di decidere se il gesto è orizzontale (swipe) o verticale (scroll).
 * Piccolo: su iPhone il gesto va "prenotato" prima che parta lo scroll del sistema (~10 pt).
 */
export const AXIS_LOCK_PX = 8;
/** Velocità (px/ms) oltre la quale anche un gesto corto conta. */
export const FLICK_VELOCITY = 0.3;
const FLICK_MIN_PX = 20;
/** Frazione della larghezza oltre la quale anche un gesto lento conta. */
const DISTANCE_FRACTION = 0.2;
/** Campioni usati per la velocità al rilascio (ms): conta come si muoveva il dito alla fine. */
const VELOCITY_WINDOW_MS = 100;
/**
 * Fascia (px) sul bordo sinistro: da lì parte lo swipe indietro, e gli swipe del contenuto non partono.
 * Il bordo destro resta libero (il pollice parte spesso da lì; su iPhone non c'è un gesto di sistema).
 */
export const EDGE_PX = 24;

/** `true` = orizzontale, `false` = verticale, `null` = ancora troppo poco per dirlo. */
export function lockAxis(dx: number, dy: number): boolean | null {
  if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return null;
  return Math.abs(dx) > Math.abs(dy);
}

/** Direzione di un trascinamento orizzontale. */
export function dirOf(dx: number): SwipeDir {
  return dx > 0 ? -1 : 1;
}

/** Il tocco parte dal bordo sinistro dello schermo (zona dello swipe indietro)? */
export function atLeftEdge(x: number, edge = EDGE_PX): boolean {
  return x <= edge;
}

/** Spostamento mostrato: segue il dito; dove non c'è niente il contenuto resta fermo. */
export function swipeOffset(dx: number, canPrevious: boolean, canNext: boolean): number {
  if ((dx > 0 && !canPrevious) || (dx < 0 && !canNext)) return 0;
  return dx;
}

/**
 * Dove andare al rilascio: −1 = precedente, +1 = successivo, 0 = resta.
 * Basta superare 1/5 della larghezza (gesto lento) o un colpo nella stessa direzione (gesto veloce).
 */
export function swipeDecision(dx: number, velocity: number, width: number, canPrevious: boolean, canNext: boolean): -1 | 0 | 1 {
  const far = Math.abs(dx) > width * DISTANCE_FRACTION;
  const flick = Math.abs(velocity) > FLICK_VELOCITY && Math.abs(dx) > FLICK_MIN_PX && Math.sign(velocity) === Math.sign(dx);
  // Ripensamento: il dito torna indietro con decisione → resta.
  const backtrack = Math.abs(velocity) > FLICK_VELOCITY && Math.sign(velocity) === -Math.sign(dx);
  if ((!far && !flick) || backtrack) return 0;
  if (dx > 0) return canPrevious ? -1 : 0;
  return canNext ? 1 : 0;
}

export interface Sample {
  x: number;
  t: number;
}

/** Velocità al rilascio (px/ms) dagli ultimi campioni: 0 se il dito si era fermato. */
export function releaseVelocity(samples: readonly Sample[], now: number): number {
  const recent = samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

/**
 * Durata (ms) dell'uscita dopo il rilascio: prosegue alla velocità del dito
 * (un colpo veloce esce in fretta, un rilascio lento con calma).
 */
export function commitDuration(remaining: number, velocity: number): number {
  const speed = Math.max(Math.abs(velocity), 1.2);
  return Math.round(Math.min(220, Math.max(90, Math.abs(remaining) / speed)));
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

/** Posizione della riga mentre si trascina: tra chiusa (0) e aperta (−width), con un po' di elasticità oltre l'apertura. */
export function revealOffset(dx: number, open: boolean, width: number): number {
  const raw = (open ? -width : 0) + dx;
  if (raw > 0) return 0;
  if (raw < -width) return -width + (raw + width) * 0.25;
  return raw;
}
