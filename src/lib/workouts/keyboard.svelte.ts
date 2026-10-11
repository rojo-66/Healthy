/** Differenza (px) tra finestra e area visibile oltre la quale consideriamo aperta la tastiera di iPhone. */
const KEYBOARD_MIN = 150;

/**
 * Tastiera virtuale aperta? Su iPhone la tastiera non ridimensiona la pagina: si restringe solo
 * `visualViewport`. Serve per nascondere il banner inferiore fisso mentre si scrive.
 * Va chiamata durante l'inizializzazione di un componente.
 */
export function keyboardState(): { readonly open: boolean } {
  let open = $state(false);
  $effect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      open = window.innerHeight - vv.height > KEYBOARD_MIN;
    };
    vv.addEventListener('resize', update);
    update();
    return () => vv.removeEventListener('resize', update);
  });
  return {
    get open() {
      return open;
    },
  };
}

/** Porta in vista il campo che riceve il focus (dopo che la tastiera è salita). */
export function keepFocusedVisible(event: FocusEvent, reduceMotion: boolean): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  window.setTimeout(() => {
    if (document.activeElement === target) target.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, 320);
}
