<script lang="ts">
  import { fade, pop } from '../design/transitions';
  import Icon from './Icon.svelte';
  import type { Tone } from './types';

  interface Props {
    checked: boolean;
    /** Cosa fa il tocco, es. "Segna serie 2 come fatta". */
    label: string;
    tone?: Tone;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(false), label, tone = 'training', disabled = false, onchange }: Props = $props();

  function toggle() {
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button
  type="button"
  class="check tap tone-{tone}"
  class:on={checked}
  aria-pressed={checked}
  aria-label={label}
  {disabled}
  onclick={toggle}
>
  <!-- Riempimento: entra con scale, non con un colore animato. -->
  <span class="fill" aria-hidden="true"></span>
  {#if checked}
    <span class="mark" in:pop out:fade={{ duration: 120 }}><Icon name="check" size={20} stroke={3} /></span>
  {:else}
    <span class="mark idle"><Icon name="check" size={18} stroke={2.5} /></span>
  {/if}
</button>

<style>
  .check {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--on-tone);
  }

  .check.on {
    border-color: var(--tone);
  }

  .fill {
    position: absolute;
    inset: -1px;
    background: var(--tone);
    transform: scale(0);
    opacity: 0;
    transition:
      transform var(--dur-ind) var(--spring),
      opacity var(--dur-press) ease;
  }

  .on .fill {
    transform: scale(1);
    opacity: 1;
  }

  .mark {
    position: relative;
    grid-area: 1 / 1;
    display: grid;
  }

  .idle {
    color: var(--muted);
    opacity: 0.55;
  }

  .check:disabled {
    opacity: 0.38;
    cursor: default;
  }
</style>
