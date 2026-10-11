<script lang="ts">
  import ProgressRing from '../../lib/components/ProgressRing.svelte';
  import { formatClock } from '../../lib/components/time';
  import type { RestTimer } from '../../lib/data/schemas/sessions';
  import { burst } from '../../lib/design/transitions';
  import { isPaused, remainingMs, remainingSec } from '../../lib/sessions/rest-timer';

  // Cerchio del recupero (96 px) al centro del banner inferiore: tocco → pannello del recupero.
  interface Props {
    rest: RestTimer | null;
    now: number;
    /** Il recupero è appena finito (mostra l'impulso). */
    pulse: boolean;
    onopen: () => void;
  }

  let { rest, now, pulse, onopen }: Props = $props();

  const left = $derived(remainingSec(rest, now));
  const paused = $derived(isPaused(rest));
  const caption = $derived(left > 0 ? (paused ? 'IN PAUSA' : 'RECUPERO') : 'PRONTO');
  const label = $derived(
    left > 0
      ? `Recupero ${left} secondi${paused ? ', in pausa' : ''}, tocca per gestire`
      : 'Recupero: pronto, tocca per gestire',
  );
</script>

<button type="button" class="rest tap" class:ready={left === 0} aria-label={label} aria-haspopup="dialog" onclick={onopen} data-testid="rest-button">
  {#if pulse}
    <span class="pulse" aria-hidden="true" in:burst></span>
  {/if}
  <span class="ring-wrap" aria-hidden="true">
    <ProgressRing
      value={remainingMs(rest, now)}
      max={Math.max(1, (rest?.totalSec ?? 0) * 1000)}
      label=""
      text={formatClock(left)}
      {caption}
      tone="training"
      size={96}
      stroke={7}
      textSize={20}
    />
  </span>
</button>

<style>
  .rest {
    position: relative;
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--bg);
    color: var(--text);
  }

  .ring-wrap {
    position: relative;
    display: grid;
  }

  /* Fine recupero: un anello che si allarga e svanisce (solo transform/opacity). */
  .pulse {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid var(--training);
    box-shadow: 0 0 22px var(--training-glow);
    opacity: 0;
    pointer-events: none;
  }
</style>
