import { prefersReducedMotion } from './transitions';
import { dirOf, EDGE_PX, lockAxis, nearEdge, pickZone, swipeDecision, swipeOffset, type SwipeDir } from './swipe';
import { opensKeyboard, viewport } from './viewport.svelte';

/**
 * Unico gestore dei trascinamenti orizzontali (Pointer Events). Regole comuni:
 * - lo scroll verticale resta al browser (`touch-action: pan-y pinch-zoom`: anche il pizzico resta);
 * - non parte da campi di testo, da `[data-swipe-ignore]` (grafici, strisce che scorrono), con la tastiera
 *   aperta, né vicino ai bordi dello schermo (a sinistra c'è lo swipe indietro);
 * - zone annidate: al blocco dell'asse vince la più interna che gestisce quella direzione;
 * - il tocco finito con uno swipe non preme il pulsante sotto il dito.
 */
export interface SwipeHandlers {
  /** `exclude` (di base): non parte vicino ai bordi. `left-edge`: parte SOLO dal bordo sinistro. */
  edge?: 'exclude' | 'left-edge';
  /** La zona gestisce questa direzione? Se no il gesto passa alla zona esterna. */
  claims(dir: SwipeDir): boolean;
  /** Il gesto è diventato orizzontale ed è di questa zona. */
  begin?(): void;
  move(dx: number): void;
  end(dx: number, velocity: number): void;
  /** Gesto annullato dal sistema (pointercancel) dopo l'inizio. */
  cancel(): void;
}

interface Zone {
  claims(dir: SwipeDir): boolean;
}

const IGNORE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-swipe-ignore]';
/** Zone che hanno iniziato a seguire questo tocco, dalla più interna (l'evento sale dal bersaglio). */
const chains = new WeakMap<Event, Zone[]>();

export function trackSwipe(node: HTMLElement, handlers: () => SwipeHandlers): { destroy(): void } {
  const zone: Zone = { claims: (dir) => handlers().claims(dir) };
  let start: { x: number; y: number } | null = null;
  let pointer = -1;
  let axis: boolean | null = null;
  let inner: Zone[] = [];
  let dx = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let suppressClick = false;

  function down(e: PointerEvent) {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const h = handlers();
    const fromEdge = h.edge === 'left-edge';
    if (fromEdge ? e.clientX > EDGE_PX : nearEdge(e.clientX, window.innerWidth)) return;
    const target = e.target instanceof Element ? e.target.closest(IGNORE) : null;
    if (target && node.contains(target)) return;
    if (viewport.keyboardOpen || opensKeyboard(document.activeElement)) return;
    inner = chains.get(e) ?? [];
    chains.set(e, [...inner, zone]);
    start = { x: e.clientX, y: e.clientY };
    pointer = e.pointerId;
    axis = null;
    dx = 0;
    velocity = 0;
    lastX = e.clientX;
    lastT = e.timeStamp;
  }

  function move(e: PointerEvent) {
    if (!start || e.pointerId !== pointer) return;
    const ddx = e.clientX - start.x;
    if (axis === null) {
      axis = lockAxis(ddx, e.clientY - start.y);
      if (axis === null) return;
      // Verticale, o il gesto è di un'altra zona (più interna o esterna): questa si fa da parte.
      if (axis === false || pickZone([...inner, zone], dirOf(ddx), (z, d) => z.claims(d)) !== zone) {
        start = null;
        return;
      }
      node.setPointerCapture?.(e.pointerId);
      // Con il mouse il trascinamento selezionerebbe il testo (e la volta dopo partirebbe il drag nativo).
      node.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
      handlers().begin?.();
    }
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = e.timeStamp;
    dx = ddx;
    handlers().move(dx);
  }

  function up(e: PointerEvent) {
    if (!start || e.pointerId !== pointer) return;
    const horizontal = axis === true;
    start = null;
    axis = null;
    if (!horizontal) return;
    node.style.userSelect = '';
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 50);
    if (e.timeStamp - lastT > 100) velocity = 0;
    handlers().end(dx, velocity);
  }

  function cancel(e: PointerEvent) {
    if (!start || e.pointerId !== pointer) return;
    const horizontal = axis === true;
    start = null;
    axis = null;
    if (!horizontal) return;
    node.style.userSelect = '';
    handlers().cancel();
  }

  /** Il drag nativo (testo selezionato, immagini) annullerebbe il gesto con `pointercancel`. */
  function dragStart(e: DragEvent) {
    e.preventDefault();
  }

  function clickCapture(e: MouseEvent) {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }

  node.style.touchAction = 'pan-y pinch-zoom';
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('click', clickCapture, true);
  node.addEventListener('dragstart', dragStart);
  return {
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('click', clickCapture, true);
      node.removeEventListener('dragstart', dragStart);
    },
  };
}

// --- Sfoglia: giorni, esercizi, tab ---

export interface SwipeOptions {
  /** C'è qualcosa in quella direzione? (−1 = precedente, +1 = successivo) */
  canGo: (dir: SwipeDir) => boolean;
  onswipe: (dir: SwipeDir) => void;
  /**
   * Elemento che segue il dito (di base il nodo stesso). Meglio un figlio: il nodo che ascolta resta fermo,
   * così uno swipe fatto mentre il contenuto torna a posto non "manca" il bersaglio.
   */
  target?: HTMLElement | undefined;
  /** Avanzamento durante il trascinamento (frazione della larghezza, + verso il successivo; 0 alla fine). */
  onprogress?: (fraction: number) => void;
  /**
   * Al cambio il contenuto torna a posto subito, senza molla: il nuovo contenuto entra con la sua transizione
   * (sessione live, tab). Di base torna a molla (giorni: parte del contenuto resta montata).
   */
  snap?: boolean;
  /** Direzioni gestite (di base tutte: dove non c'è niente il contenuto resiste e torna a posto). */
  claims?: (dir: SwipeDir) => boolean;
}

/**
 * Azione `use:swipe`: il contenuto segue il dito (solo `transform`), al rilascio si assesta a molla sul
 * vicino o torna a posto. Con "riduci movimento" non segue il dito: cambia e basta.
 */
export function swipe(node: HTMLElement, initial: SwipeOptions) {
  let options = initial;
  const moving = () => options.target ?? node;

  function settle(changed = false) {
    const el = moving();
    const instant = prefersReducedMotion() || (changed && options.snap === true);
    el.style.transition = instant ? 'none' : 'transform var(--dur-ind) var(--spring)';
    el.style.transform = '';
    options.onprogress?.(0);
  }

  const tracker = trackSwipe(node, () => ({
    claims: (dir) => options.claims?.(dir) ?? true,
    begin() {
      moving().style.transition = 'none';
    },
    move(dx) {
      const offset = swipeOffset(dx, options.canGo(-1), options.canGo(1));
      if (prefersReducedMotion()) return;
      moving().style.transform = `translateX(${offset}px)`;
      options.onprogress?.(-offset / (node.offsetWidth || window.innerWidth));
    },
    end(dx, velocity) {
      const dir = swipeDecision(dx, velocity, node.offsetWidth || window.innerWidth, options.canGo(-1), options.canGo(1));
      settle(dir !== 0);
      if (dir !== 0) options.onswipe(dir);
    },
    cancel: () => settle(),
  }));

  return {
    update(next: SwipeOptions) {
      options = next;
    },
    destroy() {
      tracker.destroy();
    },
  };
}
