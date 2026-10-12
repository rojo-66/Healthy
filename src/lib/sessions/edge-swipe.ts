import { prefersReducedMotion } from '../design/transitions';
import { trackSwipe } from '../design/swipe-action';

export { EDGE_PX } from '../design/swipe';

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
 *
 * Con `{ onback, leaves }` la schermata può chiedere conferma (es. Editor con modifiche): se `leaves()` è
 * falso il contenuto torna a posto e `onback` apre la sua conferma, come la freccia.
 */
export type EdgeBack = (() => void) | { onback: () => void; leaves: () => boolean };

export function edgeSwipe(node: HTMLElement, back: EdgeBack) {
  let current = back;
  const callback = () => (typeof current === 'function' ? current() : current.onback());
  const leaves = () => typeof current === 'function' || current.leaves();

  function reset(animated: boolean) {
    node.style.transition = animated && !prefersReducedMotion() ? 'transform var(--dur-ind) var(--spring)' : 'none';
    node.style.transform = '';
  }

  const tracker = trackSwipe(node, () => ({
    edge: 'left-edge',
    claims: (dir) => dir === -1,
    begin() {
      node.style.transition = 'none';
    },
    move(dx) {
      if (!prefersReducedMotion()) node.style.transform = `translateX(${Math.max(0, dx)}px)`;
    },
    end(dx, velocity) {
      if (!shouldGoBack(dx, velocity, node.clientWidth || window.innerWidth)) return reset(true);
      if (!leaves()) {
        reset(true);
        return callback();
      }
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
    },
  }));

  return {
    update(next: EdgeBack) {
      current = next;
    },
    destroy() {
      tracker.destroy();
    },
  };
}
