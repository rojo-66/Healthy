<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { fade, prefersReducedMotion, sheet } from '../design/transitions';
  import Icon from './Icon.svelte';
  import { dragOffset, shouldDismiss } from './sheet-gesture';
  import type { Tone } from './types';

  interface Props {
    open: boolean;
    title: string;
    tone: Tone;
    onclose?: () => void;
    children: Snippet;
  }

  let { open = $bindable(false), title, tone, onclose, children }: Props = $props();

  const id = $props.id();
  let dialog: HTMLDialogElement;
  let panel = $state<HTMLDivElement>();
  /** Contenuto montato: resta true durante l'animazione di uscita. */
  let shown = $state(false);
  /** Dopo una chiusura col dito il pannello è già fuori schermo: uscita senza animazione. */
  let instantOut = $state(false);
  let opener: HTMLElement | null = null;
  let previousOverflow = '';

  $effect(() => {
    if (open && !shown) void show();
    else if (!open && shown) shown = false;
  });

  async function show() {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    instantOut = false;
    dialog.showModal();
    shown = true;
    await tick();
    panel?.focus();
  }

  function close() {
    open = false;
  }

  /** Fine dell'uscita: chiude il dialog nativo e restituisce il focus. */
  function finish() {
    if (!dialog.open) return;
    dialog.close();
    document.documentElement.style.overflow = previousOverflow;
    onclose?.();
    opener?.focus();
    opener = null;
  }

  $effect(() => () => {
    // Smontato mentre era aperto: sblocca lo scroll.
    if (shown) document.documentElement.style.overflow = previousOverflow;
  });

  // Esc: il browser chiuderebbe subito il dialog; lo chiudo io con l'animazione.
  function oncancel(e: Event) {
    e.preventDefault();
    close();
  }

  // --- Trascinamento verso il basso dalla maniglia/intestazione ---
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let dragging = false;

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0 || !panel) return;
    if ((e.target as HTMLElement).closest('button')) return;
    dragging = true;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    panel.style.transition = 'none';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
    if (!dragging || !panel) return;
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (e.clientY - lastY) / dt;
    lastY = e.clientY;
    lastT = e.timeStamp;
    panel.style.transform = `translateY(${dragOffset(e.clientY - startY)}px)`;
  }

  function onpointerup(e: PointerEvent) {
    if (!dragging || !panel) return;
    dragging = false;
    const dy = e.clientY - startY;
    // Dito fermo prima del rilascio: nessun "colpo".
    if (e.timeStamp - lastT > 100) velocity = 0;
    const p = panel;
    const reduce = prefersReducedMotion();
    if (shouldDismiss(dy, velocity, p.offsetHeight)) {
      instantOut = true;
      if (reduce) return close();
      p.style.transition = 'transform var(--dur-sheet) var(--ease-out)';
      p.style.transform = 'translateY(100%)';
      // transitionend può non arrivare (es. trascinato mentre entrava ancora): timer di riserva.
      p.addEventListener('transitionend', close, { once: true });
      setTimeout(close, 400);
    } else {
      // Torna su a molla.
      p.style.transition = reduce ? 'none' : 'transform var(--dur-ind) var(--spring)';
      p.style.transform = '';
    }
  }
</script>

<dialog bind:this={dialog} class="dialog tone-{tone}" aria-labelledby="{id}-title" {oncancel} onclose={() => (open = false)}>
  {#if shown}
    <button
      type="button"
      class="overlay"
      tabindex="-1"
      aria-label="Chiudi"
      transition:fade={{ duration: 250 }}
      onclick={close}
    ></button>
    <div
      class="panel"
      bind:this={panel}
      tabindex="-1"
      in:sheet
      out:sheet={{ duration: instantOut ? 0 : 280 }}
      onoutroend={finish}
    >
      <div class="grip" role="presentation" {onpointerdown} {onpointermove} {onpointerup} onpointercancel={onpointerup}>
        <span class="handle" aria-hidden="true"></span>
        <div class="head">
          <h2 class="title" id="{id}-title">{title}</h2>
          <button type="button" class="close tap" aria-label="Chiudi" onclick={close}>
            <Icon name="close" size={20} />
          </button>
        </div>
      </div>
      <div class="body scroll">
        {@render children()}
      </div>
    </div>
  {/if}
</dialog>

<style>
  .dialog {
    position: fixed;
    inset: 0;
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    overflow: hidden;
  }

  .dialog::backdrop {
    background: transparent;
  }

  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    background: var(--overlay);
    touch-action: none;
  }

  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - var(--safe-top) - 24px);
    padding: 0 var(--space-5) calc(var(--space-6) + var(--safe-bottom));
    padding-left: calc(var(--space-5) + var(--safe-left));
    padding-right: calc(var(--space-5) + var(--safe-right));
    background: var(--surface);
    clip-path: polygon(
      var(--cut-sheet) 0,
      calc(100% - var(--cut-sheet)) 0,
      100% var(--cut-sheet),
      100% 100%,
      0 100%,
      0 var(--cut-sheet)
    );
    box-shadow: inset 0 1px 0 var(--tone-edge);
    outline: none;
  }

  .grip {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: 14px;
    padding-bottom: var(--space-3);
    touch-action: none;
    cursor: grab;
  }

  .handle {
    align-self: center;
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-strong);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }

  .title {
    margin: 0;
    min-width: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 26px;
    line-height: 1.1;
    color: var(--tone);
  }

  .close {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
  }

  .body {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
</style>
