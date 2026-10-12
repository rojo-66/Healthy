/**
 * Altezza dello schermo e tastiera su iPhone (SPEC § 10).
 *
 * In standalone iOS `100dvh` può restare "vecchio" dopo il ritorno dal background o la chiusura della
 * tastiera, e la tastiera può lasciare la pagina scrollata: sotto la barra di navigazione resta una fascia
 * vuota. Qui l'altezza viene scritta in `--app-h` da `window.innerHeight` e, nei momenti critici
 * (app di nuovo visibile, tastiera chiusa, rotazione), la pagina torna a scroll 0.
 */

/** Differenza (px) tra finestra e area visibile oltre la quale consideriamo aperta la tastiera di iPhone. */
export const KEYBOARD_MIN = 150;

/** Tastiera aperta? Su iPhone la tastiera non ridimensiona la pagina: si restringe solo `visualViewport`. */
export function isKeyboardOpen(innerHeight: number, visualHeight: number | null): boolean {
  return visualHeight !== null && innerHeight - visualHeight > KEYBOARD_MIN;
}

/** Elemento che apre la tastiera (il focus su di esso la tiene aperta). */
export function opensKeyboard(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'image'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable === true;
}

export interface ScrollState {
  scrollY: number;
  /** Altezza del documento e della finestra: le schermate dell'app sono alte quanto lo schermo. */
  scrollHeight: number;
  innerHeight: number;
  keyboardOpen: boolean;
  focusedOpensKeyboard: boolean;
}

/**
 * La pagina va riportata a scroll 0? Solo se è spostata ma non dovrebbe scorrere (le schermate scorrono
 * dentro, il documento no: lo spostamento l'ha lasciato la tastiera) e nessun campo tiene aperta la
 * tastiera (mentre si scrive iOS sposta la pagina apposta per mostrare il campo). Le pagine lunghe che
 * scorrono col documento (pagine di prova) non vengono toccate.
 */
export function shouldResetScroll(s: ScrollState): boolean {
  if (s.scrollY === 0 || s.keyboardOpen || s.focusedOpensKeyboard) return false;
  return s.scrollHeight - s.innerHeight <= 1;
}

export interface ViewportEvent {
  at: string;
  name: string;
}

const MAX_EVENTS = 8;

/** Stato condiviso (un solo calcolo per tutta l'app). */
export const viewport = $state({
  innerHeight: 0,
  visualHeight: null as number | null,
  keyboardOpen: false,
  events: [] as ViewportEvent[],
});

let started = false;

/** Avvia l'osservazione (una volta, da `main.ts`). */
export function initViewport(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const root = document.documentElement;
  const vv = window.visualViewport ?? null;

  const log = (name: string) => {
    const at = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    viewport.events = [{ at, name }, ...viewport.events].slice(0, MAX_EVENTS);
  };

  const measure = () => {
    const h = window.innerHeight;
    viewport.innerHeight = h;
    viewport.visualHeight = vv ? Math.round(vv.height) : null;
    viewport.keyboardOpen = isKeyboardOpen(h, vv ? vv.height : null);
    if (h > 0) root.style.setProperty('--app-h', `${h}px`);
  };

  const settle = () => {
    measure();
    const reset = shouldResetScroll({
      scrollY: window.scrollY,
      scrollHeight: root.scrollHeight,
      innerHeight: window.innerHeight,
      keyboardOpen: viewport.keyboardOpen,
      focusedOpensKeyboard: opensKeyboard(document.activeElement),
    });
    if (reset) {
      window.scrollTo(0, 0);
    }
  };

  /** iOS dà valori vecchi nei primi istanti dopo il ritorno: si ricontrolla anche dopo un frame e dopo 300 ms. */
  const settleSoon = (name: string) => {
    log(name);
    settle();
    requestAnimationFrame(settle);
    setTimeout(settle, 300);
  };

  window.addEventListener('resize', () => settleSoon('resize'));
  window.addEventListener('orientationchange', () => settleSoon('rotazione'));
  window.addEventListener('pageshow', () => settleSoon('pageshow'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') settleSoon('visibile');
  });
  // Tastiera chiusa con "Fine" o toccando fuori: il focus esce dal campo e non entra in un altro.
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!opensKeyboard(document.activeElement)) settleSoon('campo lasciato');
    }, 100);
  });
  vv?.addEventListener('resize', () => {
    const wasOpen = viewport.keyboardOpen;
    measure();
    if (wasOpen !== viewport.keyboardOpen) settleSoon(viewport.keyboardOpen ? 'tastiera aperta' : 'tastiera chiusa');
  });

  measure();
  log('avvio');
}
