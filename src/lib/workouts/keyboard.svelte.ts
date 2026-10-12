import { viewport } from '../design/viewport.svelte';

/**
 * Tastiera virtuale aperta? Su iPhone la tastiera non ridimensiona la pagina: si restringe solo
 * `visualViewport`. Serve per nascondere i banner inferiori fissi mentre si scrive.
 * Lo stato è unico per tutta l'app (`design/viewport.svelte.ts`).
 */
export function keyboardState(): { readonly open: boolean } {
  return {
    get open() {
      return viewport.keyboardOpen;
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
