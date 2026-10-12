<script lang="ts" generics="Id extends string">
  import type { SeriesTone } from './geometry';

  /**
   * Interruttore a due o tre pulsanti attaccati (Grafico/Tabella, Carico/Volume): `aria-pressed`,
   * 44 px di altezza, colore della sezione.
   */
  interface Props {
    options: readonly { id: Id; label: string }[];
    value: Id;
    /** Nome del gruppo per lo screen reader, es. "Vista del peso". */
    label: string;
    tone: SeriesTone;
    onchange: (id: Id) => void;
  }

  let { options, value, label, tone, onchange }: Props = $props();
</script>

<div class="toggle tone-{tone}" role="group" aria-label={label}>
  {#each options as opt (opt.id)}
    <button type="button" class="tap" aria-pressed={opt.id === value} onclick={() => opt.id !== value && onchange(opt.id)}>
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .toggle {
    display: flex;
    flex-shrink: 0;
  }

  button {
    height: var(--touch);
    min-width: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
  }

  button + button {
    border-left: 0;
  }

  button[aria-pressed='true'] {
    background: var(--tone);
    border-color: var(--tone);
    color: var(--on-tone);
  }
</style>
