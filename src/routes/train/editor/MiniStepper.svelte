<script lang="ts">
  import { clamp, formatNumber } from '../../../lib/components/stepper';

  // Stepper compatto in riga (− valore +) per la tabella delle serie diverse. Pulsanti da 44 px.
  interface Props {
    /** Nome per gli screen reader, es. "Serie 2, ripetizioni". */
    label: string;
    value: number;
    min: number;
    max: number;
    /** Passo personalizzato (kg); senza, ±1. */
    next?: (value: number, dir: 1 | -1) => number;
    invalid?: boolean;
    onchange: (value: number) => void;
  }

  let { label, value, min, max, next, invalid = false, onchange }: Props = $props();

  const step = (dir: 1 | -1) => clamp(next ? next(value, dir) : value + dir, min, max);
</script>

<div class="mini" class:invalid role="group" aria-label={label}>
  <button type="button" class="tap" aria-label="{label}: meno" disabled={value <= min} onclick={() => onchange(step(-1))}>−</button>
  <output class="mono" aria-live="polite">{formatNumber(value)}</output>
  <button type="button" class="tap" aria-label="{label}: più" disabled={value >= max} onclick={() => onchange(step(1))}>+</button>
</div>

<style>
  .mini {
    display: grid;
    grid-template-columns: var(--touch) minmax(36px, 1fr) var(--touch);
    align-items: center;
    min-width: 0;
  }

  button {
    height: var(--touch);
    padding: 0;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 18px;
    line-height: 1;
  }

  button:disabled {
    opacity: 0.38;
  }

  output {
    text-align: center;
    font-size: 15px;
    font-weight: 700;
  }

  .invalid output {
    color: var(--tip);
  }
</style>
