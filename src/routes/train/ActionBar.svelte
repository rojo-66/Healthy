<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tone } from '../../lib/components/types';

  // Banner inferiore fisso dell'editor e dell'anteprima (mockup Editor: 1fr 2fr, bordo nel colore della sezione).
  interface Props {
    /** Nascosto (con la tastiera aperta): scivola giù, solo transform/opacity. */
    hidden?: boolean;
    tone?: Tone;
    /** Due azioni di pari peso (es. Salva come copia / Sostituisci): colonne uguali invece di 1fr 2fr. */
    even?: boolean;
    children: Snippet;
  }

  let { hidden = false, tone = 'training', even = false, children }: Props = $props();
</script>

<footer class="bar tone-{tone}" class:hidden class:even aria-hidden={hidden || undefined} inert={hidden}>
  {@render children()}
</footer>

<style>
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-banner);
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 10px;
    padding: 14px calc(var(--space-5) + var(--safe-right)) max(14px, calc(var(--safe-bottom) + 8px))
      calc(var(--space-5) + var(--safe-left));
    background: var(--surface);
    box-shadow: inset 0 1px 0 var(--tone-edge);
    transition:
      transform var(--dur-sheet) var(--ease-out),
      opacity var(--dur-fade) ease;
  }

  .even {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hidden {
    transform: translateY(100%);
    opacity: 0;
  }
</style>
