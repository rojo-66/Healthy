<script lang="ts" module>
  export interface TableColumn {
    label: string;
    align?: 'left' | 'right';
  }

  export interface TableRow {
    key: string;
    cells: readonly string[];
  }
</script>

<script lang="ts">
  /**
   * Vista "Tabella" equivalente a un grafico (SPEC § 5.7): stessi dati, come testo.
   * È una vera `<table>`, così lo screen reader legge righe e colonne.
   */
  interface Props {
    caption: string;
    columns: readonly TableColumn[];
    rows: readonly TableRow[];
    testid?: string;
  }

  let { caption, columns, rows, testid }: Props = $props();
</script>

<table data-testid={testid}>
  <caption class="visually-hidden">{caption}</caption>
  <thead>
    <tr>
      {#each columns as col, i (i)}
        <th scope="col" class:right={col.align === 'right'}>{col.label}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.key)}
      <tr>
        {#each row.cells as cell, i (i)}
          {#if i === 0}
            <th scope="row">{cell}</th>
          {:else}
            <td class:right={columns[i]?.align === 'right'}>{cell}</td>
          {/if}
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 14px;
  }

  thead th {
    padding-bottom: var(--space-2);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1px;
    text-align: left;
    color: var(--muted);
  }

  tbody th,
  td {
    padding: 10px 0;
    border-top: 1px solid var(--line);
    text-align: left;
    font-weight: 400;
    overflow-wrap: anywhere;
  }

  td {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  td:nth-child(2) {
    font-weight: 700;
  }

  .right {
    text-align: right;
  }
</style>
