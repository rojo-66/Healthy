<script lang="ts">
  import { onMount } from 'svelte';
  import type { Tone } from './types';

  interface Props {
    value: number;
    max: number;
    /** Nome letto dagli screen reader, es. "Proteine". */
    label: string;
    /** Testo del valore, es. "35 di 141 g". */
    valueText?: string;
    tone: Tone;
    height?: number;
    rounded?: boolean;
  }

  let { value, max, label, valueText, tone, height = 6, rounded = false }: Props = $props();

  const fraction = $derived(max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);
  // Parte da vuota e si riempie al montaggio (SPEC § 4: "riempimento animato").
  let ready = $state(false);
  onMount(() => {
    requestAnimationFrame(() => (ready = true));
  });
</script>

<div
  class="track tone-{tone}"
  class:rounded
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={value}
  aria-valuetext={valueText}
  style:height="{height}px"
>
  <!-- translateX invece di width: si anima solo transform. -->
  <div class="fill bar" style:transform="translateX({((ready ? fraction : 0) - 1) * 100}%)"></div>
</div>

<style>
  .track {
    position: relative;
    overflow: hidden;
    background: var(--line);
  }

  .rounded {
    border-radius: 999px;
  }

  .fill {
    position: absolute;
    inset: 0;
    background: var(--tone);
  }
</style>
