import { prefersReducedMotion } from '../design/transitions';

/** Larghezza (px) della fascia sul bordo sinistro da cui parte lo swipe indietro. */
export const EDGE_PX = 24;

/**
 * Lo swipe torna indietro? Oltre un terzo della larghezza, oppure con un colpo veloce (> 0,5 px/ms)
 * di almeno 40 px verso destra.
 */
export function shouldGoBack(dx: number, velocity: number, width: number): boolean {
  if (dx <= 0) return false;
  return dx > width / 3 || (velocity > 0.5 && dx > 40);
}

/**
 * Swipe indietro dal bordo sinistro (in standalone iOS non c'è quello di Safari, SPEC § 4).
 * Il contenuto segue il dito (solo `transform`); al rilascio esce a destra o torna a molla.
 * Mai sulla sessione live: lì si esce solo dalla freccia con conferma.
 */
export function edgeSwipe(node: HTMLElement, onback: () => void) {
  let callback = onback;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let tracking = false;
  let horizontal = false;
  let pointer = -1;

  function reset(animated: boolean) {
    node.style.transition = animated && !prefersReducedMotion() ? 'transform var(--dur-ind) var(--spring)' : 'none';
    node.style.transform = '';
  }

  function down(e: PointerEvent) {
    if (e.button !== 0 || e.clientX > EDGE_PX) return;
    tracking = true;
    horizontal = false;
    pointer = e.pointerId;
    startX = lastX = e.clientX;
    startY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
  }

  function move(e: PointerEvent) {
    if (!tracking || e.pointerId !== pointer) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        tracking = false;
        return;
      }
      if (dx < 10) return;
      horizontal = true;
      node.setPointerCapture?.(e.pointerId);
      node.style.transition = 'none';
    }
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = e.timeStamp;
    if (!prefersReducedMotion()) node.style.transform = `translateX(${Math.max(0, dx)}px)`;
  }

  function up(e: PointerEvent) {
    if (!tracking || e.pointerId !== pointer) return;
    tracking = false;
    if (!horizontal) return;
    if (e.timeStamp - lastT > 100) velocity = 0;
    const dx = e.clientX - startX;
    if (!shouldGoBack(dx, velocity, node.clientWidth || window.innerWidth)) return reset(true);
    if (prefersReducedMotion()) return callback();
    node.style.transition = 'transform var(--dur-sheet) var(--ease-out)';
    node.style.transform = 'translateX(100%)';
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      callback();
    };
    node.addEventListener('transitionend', go, { once: true });
    setTimeout(go, 400);
  }

  function cancel(e: PointerEvent) {
    if (e.pointerId !== pointer) return;
    if (tracking && horizontal) reset(true);
    tracking = false;
  }

  // Lo scroll verticale resta al browser; i gesti orizzontali arrivano qui.
  node.style.touchAction = 'pan-y';
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  return {
    update(next: () => void) {
      callback = next;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
    },
  };
}
