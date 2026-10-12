import { prefersReducedMotion } from './transitions';
import {
  atLeftEdge,
  commitDuration,
  dirOf,
  EDGE_PX,
  lockAxis,
  pickZone,
  releaseVelocity,
  swipeDecision,
  swipeOffset,
  type Sample,
  type SwipeDir,
} from './swipe';
import { opensKeyboard, viewport } from './viewport.svelte';

/**
 * Unico gestore dei trascinamenti orizzontali. Regole comuni:
 * - Pointer Events per posizione e velocità; su iPhone il gesto orizzontale viene anche "prenotato"
 *   annullando il `touchmove` (altrimenti Safari se lo prende e manda `pointercancel`: lo swipe si blocca);
 * - lo scroll verticale resta al browser (`touch-action: pan-y`) e il pizzico resta (manipulation altrove);
 * - non parte mentre si scrive (campo attivo o tastiera aperta), da `[data-swipe-ignore]` (grafici,
 *   strisce che scorrono) né dal bordo sinistro (lì c'è lo swipe indietro);
 * - zone annidate: al blocco dell'asse vince la più interna che gestisce quella direzione;
 * - il tocco finito con uno swipe non preme il pulsante sotto il dito.
 */
export interface SwipeHandlers {
  /** `exclude` (di base): non parte dal bordo sinistro. `left-edge`: parte SOLO dal bordo sinistro. */
  edge?: 'exclude' | 'left-edge';
  /** La zona gestisce questa direzione? Se no il gesto passa alla zona esterna. */
  claims(dir: SwipeDir): boolean;
  /** Il gesto è diventato orizzontale ed è di questa zona. */
  begin?(): void;
  move(dx: number): void;
  /** Rilascio (o annullamento del sistema) dopo l'inizio: spostamento e velocità finale (px/ms). */
  end(dx: number, velocity: number): void;
}

interface Zone {
  claims(dir: SwipeDir): boolean;
}

/** Zone che seguono questo tocco, dalla più interna (l'evento sale dal bersaglio). */
const chains = new WeakMap<Event, Zone[]>();

export function trackSwipe(node: HTMLElement, handlers: () => SwipeHandlers): { destroy(): void } {
  const zone: Zone = { claims: (dir) => handlers().claims(dir) };
  let start: { x: number; y: number } | null = null;
  let pointer = -1;
  let axis: boolean | null = null;
  let captured = false;
  let inner: Zone[] = [];
  let dx = 0;
  let samples: Sample[] = [];
  let suppressClick = false;

  function down(e: PointerEvent) {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const h = handlers();
    const fromEdge = atLeftEdge(e.clientX, EDGE_PX);
    if (h.edge === 'left-edge' ? !fromEdge : fromEdge) return;
    const ignored = e.target instanceof Element ? e.target.closest('[data-swipe-ignore]') : null;
    if (ignored && node.contains(ignored)) return;
    // Mentre si scrive niente swipe (un campo non attivo invece si può trascinare: il tocco non lo attiva).
    if (viewport.keyboardOpen || opensKeyboard(document.activeElement)) return;
    inner = chains.get(e) ?? [];
    chains.set(e, [...inner, zone]);
    start = { x: e.clientX, y: e.clientY };
    pointer = e.pointerId;
    axis = null;
    captured = false;
    dx = 0;
    samples = [{ x: e.clientX, t: e.timeStamp }];
  }

  /** Decide l'asse (dal primo tra pointermove e touchmove): `true` se il gesto è orizzontale e di questa zona. */
  function decide(x: number, y: number): boolean {
    if (!start) return false;
    if (axis !== null) return axis;
    const lock = lockAxis(x - start.x, y - start.y);
    if (lock === null) return false;
    // Verticale, o il gesto è di un'altra zona (più interna o esterna): questa si fa da parte.
    if (!lock || pickZone([...inner, zone], dirOf(x - start.x), (z, d) => z.claims(d)) !== zone) {
      start = null;
      return false;
    }
    axis = true;
    // Con il mouse il trascinamento selezionerebbe il testo (e la volta dopo partirebbe il drag nativo).
    node.style.userSelect = 'none';
    window.getSelection()?.removeAllRanges();
    handlers().begin?.();
    return true;
  }

  function move(e: PointerEvent) {
    if (!start || e.pointerId !== pointer || !decide(e.clientX, e.clientY)) return;
    if (!captured) {
      captured = true;
      node.setPointerCapture?.(e.pointerId);
    }
    dx = e.clientX - start.x;
    samples.push({ x: e.clientX, t: e.timeStamp });
    if (samples.length > 12) samples.shift();
    handlers().move(dx);
  }

  /** iPhone: annullare il touchmove impedisce a Safari di prendersi il gesto (e di mandare pointercancel). */
  function touchmove(e: TouchEvent) {
    const t = e.changedTouches[0];
    if (!t || !start) return;
    if (decide(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
  }

  function finish(e: PointerEvent, useEventPosition: boolean) {
    if (!start || e.pointerId !== pointer) return;
    const origin = start;
    const horizontal = axis === true;
    start = null;
    axis = null;
    if (!horizontal) return;
    node.style.userSelect = '';
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 50);
    if (useEventPosition) {
      dx = e.clientX - origin.x;
      samples.push({ x: e.clientX, t: e.timeStamp });
    }
    handlers().end(dx, releaseVelocity(samples, e.timeStamp));
  }

  const up = (e: PointerEvent) => finish(e, true);
  // Annullato dal sistema dopo l'inizio: si chiude come un rilascio nell'ultima posizione nota.
  const cancel = (e: PointerEvent) => finish(e, false);

  /** Il drag nativo (testo selezionato, immagini) annullerebbe il gesto. */
  function dragStart(e: DragEvent) {
    e.preventDefault();
  }

  function clickCapture(e: MouseEvent) {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }

  node.style.touchAction = 'pan-y';
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('touchmove', touchmove, { passive: false });
  node.addEventListener('click', clickCapture, true);
  node.addEventListener('dragstart', dragStart);
  return {
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('touchmove', touchmove);
      node.removeEventListener('click', clickCapture, true);
      node.removeEventListener('dragstart', dragStart);
    },
  };
}

// --- Sfoglia: giorni, esercizi, tab ---

export interface SwipeOptions {
  /** C'è qualcosa in quella direzione? (−1 = precedente, +1 = successivo) */
  canGo: (dir: SwipeDir) => boolean;
  /** Cambio deciso: va aggiornato lo stato (il contenuto nuovo entra dal lato opposto). */
  onswipe: (dir: SwipeDir) => void;
  /**
   * Elemento che segue il dito (di base il nodo stesso). Meglio un figlio: il nodo che ascolta resta fermo,
   * così uno swipe fatto mentre il contenuto si assesta non "manca" il bersaglio.
   */
  target?: HTMLElement | undefined;
  /**
   * Avanzamento (frazione della larghezza, + verso il successivo). `dragging` = segue il dito (senza
   * ritardo); altrimenti si assesta con la sua animazione (es. evidenziatore delle tab).
   */
  onprogress?: (fraction: number, dragging: boolean) => void;
  /**
   * Direzioni gestite. Di base solo dove c'è qualcosa (altrimenti il gesto passa alla zona esterna).
   * `() => true` tiene il gesto anche dove non c'è niente (il contenuto resta fermo).
   */
  claims?: (dir: SwipeDir) => boolean;
}

/**
 * Azione `use:swipe`: il contenuto segue il dito a qualsiasi velocità (solo `transform`). Al rilascio,
 * se il gesto basta, prosegue fuori alla velocità del dito, cambia, e il contenuto nuovo entra dal lato
 * opposto; altrimenti torna a posto a molla. Con "riduci movimento" non segue il dito: cambia e basta.
 */
export function swipe(node: HTMLElement, initial: SwipeOptions) {
  let options = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const moving = () => options.target ?? node;
  const width = () => node.offsetWidth || window.innerWidth;

  function place(offset: number, transition: string) {
    const el = moving();
    el.style.transition = transition;
    el.style.transform = offset === 0 ? '' : `translateX(${offset}px)`;
  }

  function release() {
    moving().style.willChange = '';
  }

  /** Non basta: torna a posto a molla. */
  function back() {
    place(0, prefersReducedMotion() ? 'none' : 'transform var(--dur-ind) var(--spring)');
    options.onprogress?.(0, false);
    release();
  }

  /** Basta: esce dalla sua parte alla velocità del dito, cambia, il nuovo entra dal lato opposto. */
  function commit(dir: SwipeDir, dx: number, velocity: number) {
    if (prefersReducedMotion()) {
      place(0, 'none');
      options.onprogress?.(0, false);
      release();
      options.onswipe(dir);
      return;
    }
    const w = width();
    const out = -dir * w;
    const ms = commitDuration(out - dx, velocity);
    place(out, `transform ${ms}ms cubic-bezier(0.25, 0.6, 0.5, 1)`);
    options.onprogress?.(dir, false);
    timer = setTimeout(() => {
      timer = undefined;
      options.onprogress?.(0, false);
      options.onswipe(dir);
      // Riparte dal lato opposto (senza animazione), poi entra.
      place(dir * w, 'none');
      void moving().offsetWidth;
      place(0, 'transform var(--dur-sheet) var(--ease-out)');
      release();
    }, ms);
  }

  const tracker = trackSwipe(node, () => ({
    claims: (dir) => timer === undefined && (options.claims?.(dir) ?? options.canGo(dir)),
    begin() {
      const el = moving();
      el.style.transition = 'none';
      el.style.willChange = 'transform';
    },
    move(dx) {
      if (prefersReducedMotion()) return;
      const offset = swipeOffset(dx, options.canGo(-1), options.canGo(1));
      place(offset, 'none');
      options.onprogress?.(-offset / width(), true);
    },
    end(dx, velocity) {
      const dir = swipeDecision(dx, velocity, width(), options.canGo(-1), options.canGo(1));
      if (dir === 0) back();
      else commit(dir, swipeOffset(dx, options.canGo(-1), options.canGo(1)), velocity);
    },
  }));

  return {
    update(next: SwipeOptions) {
      options = next;
    },
    destroy() {
      clearTimeout(timer);
      tracker.destroy();
    },
  };
}
