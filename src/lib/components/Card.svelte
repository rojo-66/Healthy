<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tone } from './types';

  interface Props {
    tone: Tone;
    /** Dimensione dell'angolo tagliato: 8 / 12 / 18 px. */
    cut?: 's' | 'm' | 'l';
    /** Diagonale dei tagli: 'a' = alto-sinistra e basso-destra, 'b' = alto-destra e basso-sinistra. */
    corners?: 'a' | 'b';
    glow?: boolean;
    as?: 'section' | 'div' | 'article';
    label?: string;
    children: Snippet;
  }

  let { tone, cut = 'l', corners = 'a', glow = false, as = 'section', label, children }: Props = $props();
</script>

<!-- Il bagliore sta sul contenitore: clip-path taglierebbe un box-shadow esterno. -->
<div class="frame tone-{tone}" class:glow>
  <svelte:element this={as} class="card cut-{cut} corners-{corners}" aria-label={label}>
    {@render children()}
  </svelte:element>
</div>

<style>
  .frame.glow {
    filter: drop-shadow(0 0 14px var(--tone-glow));
  }

  .card {
    --c: var(--cut-l);
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    /* Bordo 1 px che segue anche gli angoli tagliati: fondo nel colore del bordo, superficie sopra. */
    background: var(--tone-edge);
  }

  .card::before {
    content: '';
    position: absolute;
    inset: 1px;
    z-index: -1;
    background: var(--surface);
    clip-path: var(--shape);
  }

  .cut-s {
    --c: var(--cut-s);
  }
  .cut-m {
    --c: var(--cut-m);
  }

  .corners-a {
    --shape: polygon(var(--c) 0, 100% 0, 100% calc(100% - var(--c)), calc(100% - var(--c)) 100%, 0 100%, 0 var(--c));
    clip-path: var(--shape);
  }
  .corners-b {
    --shape: polygon(0 0, calc(100% - var(--c)) 0, 100% var(--c), 100% 100%, var(--c) 100%, 0 calc(100% - var(--c)));
    clip-path: var(--shape);
  }
</style>
