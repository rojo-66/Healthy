<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import { formatClock } from '../../lib/components/time';
  import type { RestTimer } from '../../lib/data/schemas/sessions';
  import { isPaused, remainingSec, REST_PRESETS, REST_STEP_SEC } from '../../lib/sessions/rest-timer';

  // Pannello del recupero (tocco sul cerchio): tempo grande, preset, ±15 s, Pausa/Riprendi, Salta, tempo del PT.
  interface Props {
    open: boolean;
    rest: RestTimer | null;
    now: number;
    /** Recupero predefinito del PT per l'esercizio corrente. */
    defaultSec: number;
    onstart: (sec: number) => void;
    onadjust: (deltaSec: number) => void;
    ontogglepause: () => void;
    onskip: () => void;
  }

  let { open = $bindable(false), rest, now, defaultSec, onstart, onadjust, ontogglepause, onskip }: Props = $props();

  const left = $derived(remainingSec(rest, now));
  const paused = $derived(isPaused(rest));
  const running = $derived(left > 0);

  function skip() {
    onskip();
    open = false;
  }
</script>

<BottomSheet bind:open title="Recupero" tone="training">
  <span class="big mono" role="timer" aria-label="Recupero rimasto {formatClock(left)}">{formatClock(left)}</span>

  <div class="grid4" role="group" aria-label="Durata">
    {#each REST_PRESETS as sec (sec)}
      <button
        type="button"
        class="preset tap mono"
        class:on={rest?.totalSec === sec}
        aria-pressed={rest?.totalSec === sec}
        aria-label="Recupero di {sec} secondi"
        onclick={() => onstart(sec)}>{sec} s</button
      >
    {/each}
  </div>

  <div class="grid2">
    <Button variant="secondary" tone="neutral" label="Togli {REST_STEP_SEC} secondi" disabled={!running} onclick={() => onadjust(-REST_STEP_SEC)}>
      −{REST_STEP_SEC} s
    </Button>
    <Button variant="secondary" tone="neutral" label="Aggiungi {REST_STEP_SEC} secondi" onclick={() => onadjust(REST_STEP_SEC)}>
      +{REST_STEP_SEC} s
    </Button>
  </div>

  <div class="grid2">
    <Button variant="secondary" tone="training" disabled={!running} onclick={ontogglepause}>{paused ? 'Riprendi' : 'Pausa'}</Button>
    <Button tone="training" onclick={skip}>Salta</Button>
  </div>

  <Button variant="ghost" tone="training" onclick={() => onstart(defaultSec)}>Predefinito del PT: {defaultSec} s</Button>
  <p class="hint">Con iPhone in silenzioso il suono di fine recupero non si sente: guarda il cerchio.</p>
</BottomSheet>

<style>
  .big {
    align-self: center;
    font-weight: 700;
    font-size: 60px;
    line-height: 1;
    text-shadow: 0 0 18px var(--training-glow);
  }

  .grid4 {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .preset {
    position: relative;
    height: 48px;
    padding: 0;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--text);
    font-weight: 700;
    font-size: 14px;
  }

  .preset.on {
    border-color: var(--training);
    background: var(--training-tint);
    color: var(--training);
  }

  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
</style>
