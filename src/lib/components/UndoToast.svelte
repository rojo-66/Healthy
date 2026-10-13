<script lang="ts">
  import { fade, rise } from '../design/transitions';
  import Button from './Button.svelte';

  /**
   * Avviso con "Annulla" dopo un cambio (2c: spostamenti, salti, ripristini). Resta qualche secondo, poi sparisce.
   * Sopra la barra di navigazione, senza coprirla; entra e esce solo con `transform` e `opacity`.
   * Uso: `toast.show('Spostamenti salvati', annulla)` (con `bind:this`).
   */
  interface Props {
    /** Durata in millisecondi. */
    duration?: number;
  }

  let { duration = 6000 }: Props = $props();

  let text = $state('');
  let undo = $state.raw<(() => unknown) | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  export function show(message: string, onundo: (() => unknown) | null = null): void {
    clearTimeout(timer);
    text = message;
    undo = onundo;
    timer = setTimeout(hide, duration);
  }

  export function hide(): void {
    clearTimeout(timer);
    text = '';
    undo = null;
  }

  function cancel() {
    const run = undo;
    hide();
    void run?.();
  }

  $effect(() => () => clearTimeout(timer));
</script>

<div class="slot" role="status" aria-live="polite">
  <!-- Un avviso nuovo sostituisce il testo di quello aperto: mai due avvisi insieme. -->
  {#if text}
    <div class="toast" in:rise={{ y: 12 }} out:fade={{ duration: 150 }} data-testid="undo-toast">
      <span class="text">{text}</span>
      {#if undo}
        <Button tone="tip" variant="secondary" size="sm" onclick={cancel}>Annulla</Button>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Sopra la barra di navigazione, come l'avviso di aggiornamento. */
  .slot {
    position: fixed;
    left: calc(16px + var(--safe-left));
    right: calc(16px + var(--safe-right));
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 8px);
    z-index: var(--z-toast);
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 56px;
    padding: 6px 6px 6px 16px;
    background: var(--surface);
    border: 1px solid var(--tip);
    color: var(--text);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
  }

  .text {
    min-width: 0;
    font-size: 14px;
  }
</style>
