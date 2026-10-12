<script lang="ts">
  import ChartTable from '../../lib/charts/ChartTable.svelte';
  import { bodyTableRows, type BodyKey, type BodyPoint } from '../../lib/progress/body';

  /** Vista Tabella di una card con più piccoli grafici: una tabella per parametro, stessi dati. */
  interface Props {
    items: readonly { key: BodyKey; label: string; points: readonly BodyPoint[] }[];
    valueLabel?: string;
  }

  let { items, valueLabel = 'Valore' }: Props = $props();

  const COLUMNS = $derived([
    { label: 'DATA' },
    { label: valueLabel.toUpperCase(), align: 'right' as const },
    { label: 'VS PRIMA', align: 'right' as const },
  ]);
</script>

<div class="tables">
  {#each items as item (item.key)}
    <section class="one" aria-label={item.label}>
      <h3 class="mono-label">{item.label}</h3>
      {#if item.points.length === 0}
        <p class="none">Nessun valore in questo periodo.</p>
      {:else}
        <ChartTable caption={item.label} columns={COLUMNS} rows={bodyTableRows(item.key, item.points)} />
      {/if}
    </section>
  {/each}
</div>

<style>
  .tables {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .one {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  h3 {
    margin: 0;
    letter-spacing: 1px;
  }

  .none {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
