<script lang="ts">
  // Indicatore dei passi del flusso: Readiness → Intro PT → Esercizi.
  interface Props {
    /** Passo corrente, da 1. */
    step: 1 | 2 | 3;
  }

  let { step }: Props = $props();
  const STEPS = ['Readiness', 'Intro PT', 'Esercizi'] as const;
</script>

<ol class="steps mono" aria-label="Passo {step} di {STEPS.length}">
  {#each STEPS as label, i (label)}
    {@const n = i + 1}
    <li class:done={n < step} class:current={n === step} aria-current={n === step ? 'step' : undefined}>
      <span class="track" aria-hidden="true"><span class="fill"></span></span>
      {label}{n < step ? ' ✓' : ''}
    </li>
  {/each}
</ol>

<style>
  .steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 0;
    padding: 0 0 0 10px;
    list-style: none;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  li.current {
    color: var(--training);
  }

  .track {
    position: relative;
    height: 4px;
    overflow: hidden;
    background: var(--line);
  }

  .fill {
    position: absolute;
    inset: 0;
    background: var(--training);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform var(--dur-ring) var(--ease-out);
  }

  .done .fill,
  .current .fill {
    transform: scaleX(1);
  }

  /* overflow: hidden non taglia l'ombra dell'elemento stesso. */
  .current .track {
    box-shadow: 0 0 8px var(--training-glow);
  }
</style>
