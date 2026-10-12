<script lang="ts">
  import type { DeltaTone } from '../../lib/profile/direction';

  /**
   * Variazione colorata come nel Profilo: ciano = direzione giusta, giallo = da tenere d'occhio,
   * grigio = neutra. La freccia accompagna sempre il colore; lo screen reader legge la frase.
   */
  interface Props {
    text: string;
    tone: DeltaTone;
    spoken?: string;
    testid?: string;
  }

  let { text, tone, spoken, testid }: Props = $props();
</script>

<span class="delta {tone}" data-testid={testid} data-tone={tone}>
  {#if spoken}
    <span aria-hidden="true">{text}</span><span class="visually-hidden">{spoken}</span>
  {:else}
    {text}
  {/if}
</span>

<style>
  .delta {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .good {
    color: var(--progress);
  }

  .warn {
    color: var(--tip);
  }

  .neutral {
    color: var(--muted);
  }
</style>
