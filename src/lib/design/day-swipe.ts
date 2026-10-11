import { lockAxis, swipeDecision, swipeOffset } from '../diet/swipe';
import { EDGE_PX } from '../sessions/edge-swipe';
import { prefersReducedMotion } from './transitions';

/**
 * Swipe tra i giorni (§ 4, Home e Dieta): il contenuto segue il dito (solo `transform`), al rilascio
 * si assesta a molla sul giorno vicino o torna a posto. Lo scroll verticale resta al browser
 * (`touch-action: pan-y` e blocco dell'asse); i tocchi che partono dal bordo sinistro sono lasciati
 * allo swipe indietro di Safari. Il tocco finito con uno swipe non preme il pulsante sotto il dito.
 */
export interface DaySwipeOptions {
  hasPrevious: boolean;
  hasNext: boolean;
  /** −1 = giorno precedente (dito verso destra), +1 = successivo. */
  onswipe: (dir: -1 | 1) => void;
  /**
   * Elemento che segue il dito (di base il nodo stesso). Meglio un figlio: il nodo che ascolta resta fermo,
   * così uno swipe fatto mentre il contenuto torna a posto non "manca" il bersaglio.
   */
  target?: HTMLElement | undefined;
}

export function daySwipe(node: HTMLElement, initial: DaySwipeOptions) {
  let options = initial;
  let start: { x: number; y: number } | null = null;
  let axis: boolean | null = null;
  let dx = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let suppressClick = false;
  const moving = () => options.target ?? node;

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.clientX <= EDGE_PX) return;
    start = { x: e.clientX, y: e.clientY };
    axis = null;
    dx = 0;
    velocity = 0;
    lastX = e.clientX;
    lastT = e.timeStamp;
  }

  function move(e: PointerEvent) {
    if (!start) return;
    const ddx = e.clientX - start.x;
    if (axis === null) {
      axis = lockAxis(ddx, e.clientY - start.y);
      if (axis === false) {
        start = null;
        return;
      }
      if (axis === true) {
        node.setPointerCapture?.(e.pointerId);
        moving().style.transition = 'none';
        // Con il mouse il trascinamento selezionerebbe il testo (e la volta dopo partirebbe il drag nativo).
        node.style.userSelect = 'none';
        window.getSelection()?.removeAllRanges();
      }
    }
    if (axis !== true) return;
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = e.timeStamp;
    dx = ddx;
    if (!prefersReducedMotion()) {
      moving().style.transform = `translateX(${swipeOffset(dx, options.hasPrevious, options.hasNext)}px)`;
    }
  }

  function up(e: PointerEvent) {
    if (!start) return;
    const horizontal = axis === true;
    start = null;
    axis = null;
    if (!horizontal) return;
    node.style.userSelect = '';
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 50);
    if (e.timeStamp - lastT > 100) velocity = 0;
    const dir = swipeDecision(dx, velocity, node.offsetWidth, options.hasPrevious, options.hasNext);
    moving().style.transition = prefersReducedMotion() ? 'none' : 'transform var(--dur-ind) var(--spring)';
    moving().style.transform = '';
    if (dir !== 0) options.onswipe(dir);
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

  node.style.touchAction = 'pan-y';
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  node.addEventListener('click', clickCapture, true);
  node.addEventListener('dragstart', dragStart);
  return {
    update(next: DaySwipeOptions) {
      options = next;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      node.removeEventListener('click', clickCapture, true);
      node.removeEventListener('dragstart', dragStart);
    },
  };
}
