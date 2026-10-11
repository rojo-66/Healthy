<script lang="ts">
  import { rise } from '../design/transitions';
  import { canStep, formatNumber, stepValue } from './stepper';

  interface Props {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    /** Unità mostrata accanto al numero e letta nei pulsanti (es. "kg"). */
    unit?: string;
    disabled?: boolean;
    decLabel?: string;
    incLabel?: string;
    onchange?: (value: number) => void;
  }

  let {
    label,
    value = $bindable(),
    min = 0,
    max = 999,
    step = 1,
    unit,
    disabled = false,
    decLabel,
    incLabel,
    onchange,
  }: Props = $props();

  const id = $props.id();
  const opts = $derived({ min, max, step });
  const stepText = $derived(formatNumber(step) + (unit ? ` ${unit}` : ''));

  function change(dir: 1 | -1) {
    value = stepValue(value, dir, opts);
    onchange?.(value);
  }
</script>

<div class="stepper" role="group" aria-labelledby="{id}-label">
  <span class="mono-label" id="{id}-label">{label}</span>
  <output class="value mono" aria-live="polite" aria-labelledby="{id}-label">
    <!-- {#key} ricrea solo il numero: il vecchio sparisce subito, il nuovo entra (niente duplicati). -->
    {#key value}
      <span in:rise={{ duration: 200, y: 6 }}>{formatNumber(value)}</span>
    {/key}
    {#if unit}<span class="unit">{unit}</span>{/if}
  </output>
  <div class="buttons">
    <button
      type="button"
      class="tap"
      aria-label={decLabel ?? `Meno ${stepText}`}
      disabled={disabled || !canStep(value, -1, opts)}
      onclick={() => change(-1)}>−</button
    >
    <button
      type="button"
      class="tap"
      aria-label={incLabel ?? `Più ${stepText}`}
      disabled={disabled || !canStep(value, 1, opts)}
      onclick={() => change(1)}>+</button
    >
  </div>
</div>

<style>
  .stepper {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    min-width: 0;
  }

  .mono-label {
    font-size: 10px;
    letter-spacing: 1px;
    text-align: center;
  }

  .value {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 4px;
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .value > span:first-child {
    display: inline-block;
  }

  .unit {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }

  .buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(var(--touch), 1fr));
    gap: var(--space-1);
  }

  button {
    height: var(--touch);
    padding: 0;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 20px;
    line-height: 1;
  }

  button:disabled {
    opacity: 0.38;
    cursor: default;
  }
</style>
