import { dropIndex, shiftFor } from './calc/reorder';

/**
 * Riordino con pressione lunga sulla maniglia ⠿ e trascinamento (Pointer Events, niente drag & drop HTML5,
 * che su iPhone non funziona). Solo `transform`: la riga sollevata segue il dito, le altre scivolano
 * per farle posto; al rilascio la riga si assesta e l'ordine nuovo passa a `ondrop`.
 * La maniglia deve avere `touch-action: none`: così la pagina non scorre mentre si trascina.
 */
export interface DragReorderOptions {
  /** Contenitore delle righe: figli diretti con `data-row`. Deve essere `position: relative`. */
  list: HTMLElement;
  /** Elemento che scorre (scorrimento automatico vicino ai bordi). */
  scroller: HTMLElement;
  /** Posizione della riga trascinata. */
  index: number;
  /** Pressione lunga riconosciuta (es. chiudere la riga aperta). */
  onstart?: () => void;
  /** Rilascio: nuova posizione (uguale a `from` se non si è spostata). */
  ondrop: (from: number, to: number) => void;
  reduceMotion?: boolean;
}

export const LONG_PRESS_MS = 350;
/** Movimento oltre il quale, prima della pressione lunga, il gesto non è un trascinamento. */
const MOVE_TOLERANCE = 8;
const EDGE = 72;
const MAX_SCROLL_STEP = 14;
/** Parte bassa coperta dal banner inferiore fisso. */
const BOTTOM_COVER = 96;
const EASE = 'cubic-bezier(.2,.9,.3,1.05)';

export function longPressDrag(event: PointerEvent, opts: DragReorderOptions): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  let lastY = startY;
  let active = false;
  let measured = false;
  let finished = false;
  let raf = 0;
  let rows: HTMLElement[] = [];
  let slots: number[] = [];
  let tops: number[] = [];
  let startScroll = 0;
  const from = opts.index;
  let to = from;

  try {
    handle.setPointerCapture(pointerId);
  } catch {
    // Puntatore già rilasciato: niente cattura, il gesto finisce da solo.
  }
  handle.dataset['pressing'] = '';
  const timer = window.setTimeout(activate, LONG_PRESS_MS);

  const preventScroll = (e: TouchEvent) => e.preventDefault();

  function activate() {
    active = true;
    delete handle.dataset['pressing'];
    opts.onstart?.();
    document.addEventListener('touchmove', preventScroll, { passive: false });
    // Aspetta che la riga aperta si chiuda (aggiornamento di Svelte) prima di misurare.
    requestAnimationFrame(() => {
      if (finished) return;
      measure();
      measured = true;
      raf = requestAnimationFrame(loop);
    });
  }

  function measure() {
    rows = [...opts.list.querySelectorAll<HTMLElement>(':scope > [data-row]')];
    tops = rows.map((r) => r.offsetTop);
    const gap = rows.length > 1 ? tops[1]! - (tops[0]! + rows[0]!.offsetHeight) : 0;
    slots = rows.map((r, i) => (i < rows.length - 1 ? tops[i + 1]! - tops[i]! : r.offsetHeight + gap));
    startScroll = opts.scroller.scrollTop;
    const dragged = rows[from];
    if (!dragged) return;
    dragged.dataset['dragging'] = '';
    dragged.style.transition = 'none';
    opts.list.dataset['reordering'] = '';
    for (const [i, r] of rows.entries()) {
      if (i !== from) r.style.transition = opts.reduceMotion ? 'none' : `transform .2s ${EASE}`;
    }
  }

  function offset(): number {
    const dy = lastY - startY + (opts.scroller.scrollTop - startScroll);
    const min = (tops[0] ?? 0) - (tops[from] ?? 0);
    const max = (tops[tops.length - 1] ?? 0) - (tops[from] ?? 0);
    return Math.min(max, Math.max(min, dy));
  }

  function loop() {
    if (finished) return;
    autoScroll();
    apply();
    raf = requestAnimationFrame(loop);
  }

  function autoScroll() {
    const rect = opts.scroller.getBoundingClientRect();
    const top = rect.top + EDGE;
    const bottom = rect.bottom - BOTTOM_COVER - EDGE;
    if (lastY < top) opts.scroller.scrollTop -= Math.min(MAX_SCROLL_STEP, (top - lastY) / 4);
    else if (lastY > bottom) opts.scroller.scrollTop += Math.min(MAX_SCROLL_STEP, (lastY - bottom) / 4);
  }

  function apply() {
    const dy = offset();
    to = dropIndex(dy, slots, from);
    const dragged = rows[from];
    if (dragged) dragged.style.transform = `translateY(${dy}px) scale(1.02)`;
    for (const [i, r] of rows.entries()) {
      if (i === from) continue;
      const shift = shiftFor(i, from, to, slots[from] ?? 0);
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    }
  }

  function onmove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (!active) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) cancel();
      return;
    }
    e.preventDefault();
    lastY = e.clientY;
  }

  function onup(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (!active || !measured) return cancel();
    finish();
  }

  function cleanupListeners() {
    window.clearTimeout(timer);
    cancelAnimationFrame(raf);
    delete handle.dataset['pressing'];
    handle.removeEventListener('pointermove', onmove);
    handle.removeEventListener('pointerup', onup);
    handle.removeEventListener('pointercancel', onup);
    document.removeEventListener('touchmove', preventScroll);
    try {
      handle.releasePointerCapture(pointerId);
    } catch {
      // già rilasciato
    }
  }

  function cancel() {
    finished = true;
    cleanupListeners();
    if (active) reset();
  }

  function reset() {
    for (const r of rows) {
      r.style.transition = 'none';
      r.style.transform = '';
      delete r.dataset['dragging'];
    }
    delete opts.list.dataset['reordering'];
    requestAnimationFrame(() => {
      for (const r of rows) r.style.transition = '';
    });
  }

  function finish() {
    finished = true;
    cleanupListeners();
    const dragged = rows[from];
    const target =
      to > from ? slots.slice(from + 1, to + 1).reduce((a, b) => a + b, 0) : -slots.slice(to, from).reduce((a, b) => a + b, 0);
    const done = () => {
      // Stili tolti e ordine nuovo nello stesso giro: Svelte riordina il DOM prima del disegno, niente salti.
      reset();
      opts.ondrop(from, to);
    };
    if (!dragged || opts.reduceMotion) return done();
    dragged.style.transition = `transform .18s ${EASE}`;
    dragged.style.transform = `translateY(${target}px)`;
    window.setTimeout(done, 180);
  }

  handle.addEventListener('pointermove', onmove);
  handle.addEventListener('pointerup', onup);
  handle.addEventListener('pointercancel', onup);
}
