<script lang="ts">
  import { WEEKDAY_INITIALS } from '../diet/calc/calendar';
  import { dayMonth } from '../profile/format';
  import type { HeatCell } from '../progress/diet';
  import { weekdayDay } from '../progress/format';

  /**
   * Calendario "Pasti segnati" (SPEC § 5.7): una riga per settimana (L–D), la percentuale sempre scritta,
   * 4 livelli di verde, celle senza dati tratteggiate, oggi con contorno tratteggiato (giorno in corso).
   * È una tabella vera: lo screen reader legge settimana, giorno e valore.
   */
  interface Props {
    weeks: readonly { monday: string; cells: readonly HeatCell[] }[];
    caption: string;
    testid?: string;
  }

  let { weeks, caption, testid }: Props = $props();

  const spoken = (c: HeatCell) =>
    `${weekdayDay(c.date)}: ${c.pct === null ? 'senza dati' : `${c.pct} per cento dei pasti segnati`}${c.today ? ', in corso' : ''}`;
</script>

<table class="heat" data-testid={testid}>
  <caption class="visually-hidden">{caption}</caption>
  <thead>
    <tr>
      <th scope="col"><span class="visually-hidden">Settimana</span></th>
      {#each WEEKDAY_INITIALS as d, i (i)}
        <th scope="col" class="mono">{d}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each weeks as week (week.monday)}
      <tr>
        <th scope="row" class="mono week">{dayMonth(week.monday)}</th>
        {#each week.cells as cell (cell.date)}
          <td class="mono cell lv-{cell.level}" class:today={cell.today} data-level={cell.level}>
            <span aria-hidden="true">{cell.pct === null ? '·' : cell.pct}</span>
            <span class="visually-hidden">{spoken(cell)}</span>
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .heat {
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 3px;
    margin: -3px;
    width: calc(100% + 6px);
  }

  thead th {
    width: auto;
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
    text-align: center;
  }

  thead th:first-child {
    width: 38px;
  }

  .week {
    font-size: 10px;
    font-weight: 500;
    color: var(--muted);
    text-align: left;
    white-space: nowrap;
  }

  .cell {
    position: relative;
    height: 40px;
    padding: 0;
    text-align: center;
    vertical-align: middle;
    font-size: 12px;
    font-weight: 700;
  }

  .lv-low {
    background: var(--heat-low);
    color: var(--text);
  }
  .lv-60 {
    background: var(--heat-60);
    color: var(--on-tone);
  }
  .lv-80 {
    background: var(--heat-80);
    color: var(--on-tone);
  }
  .lv-100 {
    background: var(--heat-100);
    color: var(--on-tone);
  }
  .lv-none {
    box-shadow: inset 0 0 0 1px var(--line-strong);
    background-image: repeating-linear-gradient(135deg, transparent 0 5px, var(--line) 5px 6px);
    color: var(--muted);
  }

  .today {
    outline: 2px dashed var(--food);
    outline-offset: -2px;
  }

  .today.lv-100,
  .today.lv-80,
  .today.lv-60 {
    outline-color: var(--bg);
  }
</style>
