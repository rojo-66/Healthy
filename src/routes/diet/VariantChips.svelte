<script lang="ts">
  import { dayTypeTone } from '../../lib/diet/view';

  /**
   * Varianti di un giorno del piano (2b): un chip per tipo di giornata (rombo colorato come nella striscia).
   * Il chip della variante in uso è segnato "in uso"; toccando un altro chip la si consulta in sola lettura.
   */
  interface Props {
    types: readonly (string | null)[];
    /** Tipo della variante in uso quel giorno. */
    inUse: string | null;
    /** Variante mostrata. */
    shown: string | null;
    labelOf: (type: string | null) => string;
    onselect: (type: string | null) => void;
  }

  let { types, inUse, shown, labelOf, onselect }: Props = $props();
</script>

<div class="chips" role="group" aria-label="Varianti del giorno" data-testid="variant-chips">
  {#each types as type (type ?? '')}
    <button
      type="button"
      class="chip tap"
      aria-pressed={type === shown}
      onclick={() => onselect(type)}
    >
      <span class="diamond {dayTypeTone(type)}" aria-hidden="true"></span>
      {labelOf(type)}{#if type === inUse}<span class="in-use mono"> · in uso</span>{/if}
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--touch);
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text-2);
    font-size: 14px;
  }

  .chip[aria-pressed='true'] {
    border-color: var(--food);
    color: var(--text);
    background: var(--food-tint);
  }

  .diamond {
    width: 9px;
    height: 9px;
    transform: rotate(45deg);
    background: var(--muted);
  }

  .diamond.training {
    background: var(--training);
  }

  .diamond.progress {
    background: var(--progress);
  }

  .in-use {
    font-size: 11px;
    color: var(--muted);
  }
</style>
