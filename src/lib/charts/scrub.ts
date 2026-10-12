import type { Action } from 'svelte/action';

/**
 * Selezione su un grafico con il dito o il mouse (Pointer Events): tocco e trascinamento orizzontale
 * scelgono il punto più vicino. Il contenitore ha `touch-action: pan-y`: lo scroll verticale della
 * pagina continua a funzionare (se il browser inizia a scorrere arriva `pointercancel` e ci si ferma).
 * Tutta l'area del grafico è toccabile, quindi anche punti fitti restano facili da scegliere.
 */
export interface ScrubOptions {
  /** `x` in pixel dal bordo sinistro del contenitore. */
  onpick: (x: number) => void;
}

export const scrub: Action<HTMLElement, ScrubOptions> = (node, initial) => {
  let options = initial;
  let active: number | null = null;

  const pick = (e: PointerEvent) => options.onpick(e.clientX - node.getBoundingClientRect().left);

  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    active = e.pointerId;
    try {
      node.setPointerCapture(e.pointerId);
    } catch {
      // Alcuni browser (e jsdom) non lo supportano: si continua senza cattura.
    }
    pick(e);
  }
  function move(e: PointerEvent) {
    if (active === e.pointerId) pick(e);
  }
  function stop(e: PointerEvent) {
    if (active === e.pointerId) active = null;
  }

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointercancel', stop);
  return {
    update(next) {
      options = next;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', stop);
      node.removeEventListener('pointercancel', stop);
    },
  };
};

/** Tasti del grafico: frecce tra i punti, Home/Fine al primo e all'ultimo; `null` se il tasto non serve. */
export function nextPointIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return Math.max(0, index - 1);
    case 'ArrowRight':
    case 'ArrowUp':
      return Math.min(count - 1, index + 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
