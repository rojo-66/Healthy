<script lang="ts">
  import type { DeltaView } from '../../lib/profile/view';

  // Variazione colorata: ciano = direzione giusta, giallo = da tenere d'occhio, grigio = neutra (SPEC § 5.6).
  interface Props {
    delta: DeltaView | null;
    /** Testo quando non c'è variazione (es. "serve l'altezza"); vuoto = riga vuota. */
    empty?: string;
    align?: 'start' | 'end';
  }

  let { delta, empty = '', align = 'start' }: Props = $props();

  const TONE_SPOKEN = { good: 'direzione giusta', warn: 'da tenere d’occhio', neutral: 'neutra' } as const;
</script>

{#if delta}
  <span class="delta mono {delta.tone}" class:end={align === 'end'} data-tone={delta.tone}>
    <span aria-hidden="true">{delta.text}</span>
    <span class="visually-hidden">{delta.spoken}, {TONE_SPOKEN[delta.tone]}</span>
  </span>
{:else}
  <span class="delta mono neutral" class:end={align === 'end'} data-tone="none">{empty}</span>
{/if}

<style>
  .delta {
    display: block;
    min-height: 1.4em;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .end {
    text-align: right;
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
