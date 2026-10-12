import { createRepeater } from './stepper';

/**
 * Pressione lunga su un pulsante +/− (Stepper): dopo un attimo il passo si ripete sempre più veloce,
 * finché il dito resta sul pulsante. Si ferma al rilascio, se il dito esce dal pulsante, se la pagina
 * scorre (pointercancel) o al limite (`step` restituisce false). Un tocco breve resta un click normale;
 * il click che arriva dopo una ripetizione viene ignorato (niente passo doppio).
 */
export function pressRepeat(node: HTMLElement, step: () => boolean) {
  let current = step;
  const repeater = createRepeater(() => current());
  let suppressClick = false;
  let pressing = false;

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick = false;
    pressing = true;
    repeater.start();
  }

  function end() {
    if (!pressing) return;
    pressing = false;
    if (repeater.stop()) suppressClick = true;
  }

  /** Con il dito il puntatore resta "catturato" dal pulsante: l'uscita si controlla con le coordinate. */
  function move(e: PointerEvent) {
    if (!pressing) return;
    const r = node.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) end();
  }

  function click(e: MouseEvent) {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }

  /** Su iPhone la pressione lunga aprirebbe il menu di sistema. */
  function contextmenu(e: Event) {
    e.preventDefault();
  }

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);
  node.addEventListener('pointerleave', end);
  node.addEventListener('pointermove', move);
  node.addEventListener('click', click, true);
  node.addEventListener('contextmenu', contextmenu);
  return {
    update(next: () => boolean) {
      current = next;
    },
    destroy() {
      repeater.stop();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointerup', end);
      node.removeEventListener('pointercancel', end);
      node.removeEventListener('pointerleave', end);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('click', click, true);
      node.removeEventListener('contextmenu', contextmenu);
    },
  };
}
