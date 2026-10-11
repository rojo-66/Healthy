<script lang="ts">
  import { segmentState, type Segment } from './segments';
  import type { Tone } from './types';

  interface Props {
    segments: readonly Segment[];
    /** Indice del segmento corrente (contorno luminoso). */
    current?: number;
    /** Descrizione per gli screen reader, es. "Esercizio 2 di 6". */
    label: string;
    tone?: Tone;
  }

  let { segments, current, label, tone = 'training' }: Props = $props();
</script>

<div class="segments tone-{tone}" role="img" aria-label={label} style:--n={segments.length}>
  {#each segments as seg, i (i)}
    {@const s = segmentState(seg)}
    <span class="seg {s.kind}" class:current={i === current}>
      <span class="fill bar" style:transform="translateX({(s.fraction - 1) * 100}%)"></span>
    </span>
  {/each}
</div>

<style>
  .segments {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: var(--space-1);
  }

  .seg {
    position: relative;
    height: 6px;
    overflow: hidden;
    background: var(--line);
  }

  /* Esercizio iniziato: la parte non fatta è --partial. */
  .seg.partial {
    background: var(--partial);
  }

  /* overflow: hidden non taglia outline e ombra dell'elemento stesso. */
  .seg.current {
    outline: 1px solid var(--tone);
    outline-offset: 2px;
    box-shadow: 0 0 8px var(--tone-glow);
  }

  .fill {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 70%, var(--bg)), var(--tone));
  }
</style>
