<script lang="ts">
  import { onMount } from 'svelte';
  import { fitLabelSize, ringGeometry } from './ring';
  import type { Tone } from './types';

  interface Props {
    value: number;
    max: number;
    /** Descrizione completa per gli screen reader, es. "577 di 1819 kcal". */
    label: string;
    /** Numero grande al centro: si rimpicciolisce per non uscire mai dall'anello. */
    text: string;
    /** Riga piccola sotto il numero (es. "di 1.819 kcal", "RECUPERO"). */
    caption?: string;
    tone: Tone;
    size?: number;
    stroke?: number;
    /** Dimensione massima del numero; di base ~19% del diametro. */
    textSize?: number;
  }

  let { value, max, label, text, caption, tone, size = 124, stroke = 12, textSize }: Props = $props();

  const g = $derived(ringGeometry(size, stroke, value, max));
  const c = $derived(size / 2);
  const fontSize = $derived(fitLabelSize(text, g.innerBox, textSize ?? Math.round(size * 0.19)));

  // Parte vuoto e si riempie al montaggio; poi segue il valore (eccezione documentata: stroke-dashoffset).
  let ready = $state(false);
  onMount(() => {
    requestAnimationFrame(() => (ready = true));
  });
  const offset = $derived(ready ? g.dashoffset : g.circumference);
</script>

<div class="ring-box tone-{tone}" role="img" aria-label={label} style:width="{size}px" style:height="{size}px">
  <svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle cx={c} cy={c} r={g.r} fill="none" stroke="var(--line)" stroke-width={stroke} />
    <circle
      class="ring progress"
      class:empty={g.fraction === 0}
      cx={c}
      cy={c}
      r={g.r}
      fill="none"
      stroke="var(--tone)"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={g.dasharray}
      stroke-dashoffset={offset}
      transform="rotate(-90 {c} {c})"
    />
  </svg>
  <div class="center" aria-hidden="true" style:width="{g.innerBox}px">
    <span class="value mono" style:font-size="{fontSize}px">{text}</span>
    {#if caption}<span class="caption">{caption}</span>{/if}
  </div>
</div>

<style>
  .ring-box {
    position: relative;
    flex-shrink: 0;
  }

  /* Il bagliore deve poter uscire dal riquadro dell'SVG, altrimenti appare un quadrato. */
  svg {
    display: block;
    overflow: visible;
  }

  .progress {
    filter: drop-shadow(0 0 6px var(--tone-glow));
  }

  /* Con linecap rotondo un anello a zero mostrerebbe un puntino. */
  .empty {
    opacity: 0;
  }

  .center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    text-align: center;
  }

  .value,
  .caption {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .value {
    font-weight: 700;
    line-height: 1.1;
  }

  .caption {
    font-size: 10px;
    letter-spacing: 0.5px;
    color: var(--muted);
  }
</style>
