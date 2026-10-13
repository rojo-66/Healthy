<script lang="ts">
  import type { Run } from '../../lib/data/schemas/runs';
  import { targetLabel } from '../../lib/runs/format';
  import { weekdaysLabel } from '../../lib/workouts/format';

  // Corsa pianificata in Allena › Schede (2a): card ciano con obiettivo, giorni, ultima corsa e "Segna come fatta".
  interface Props {
    run: Run;
    /** Data dell'ultima corsa fatta (`AAAA-MM-GG`), se c'è. */
    lastDate: string | null;
    onopen: () => void;
    onlog: () => void;
  }

  let { run, lastDate, onopen, onlog }: Props = $props();

  const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  function lastLabel(date: string | null): string {
    if (!date) return 'mai fatta';
    const [, m, d] = date.split('-').map(Number);
    return `ultima: ${d} ${MONTHS[(m ?? 1) - 1]}`;
  }

  const target = $derived(targetLabel(run));
</script>

<div class="row tone-progress" data-testid="run-row">
  <button
    type="button"
    class="main tap"
    aria-haspopup="dialog"
    aria-label="Corsa {run.name}: {target || 'senza obiettivo'}, {weekdaysLabel(run.weekdays)}. Apri le azioni"
    onclick={onopen}
  >
    <span class="title-line">
      <span class="name">{run.name}</span>
      <span class="src mono">CORSA</span>
    </span>
    <span class="meta mono">{target ? `obiettivo ${target}` : 'senza obiettivo'}{run.time ? ` · ore ${run.time}` : ''}</span>
    <span class="when">
      <span class="days mono">{weekdaysLabel(run.weekdays)}</span>
      <span class="last">{lastLabel(lastDate)}</span>
    </span>
  </button>
  <button type="button" class="log tap" onclick={onlog}>Segna<br />fatta</button>
</div>

<style>
  .row {
    display: flex;
    align-items: stretch;
    background: var(--surface);
    box-shadow: inset 3px 0 0 var(--tone);
  }

  .main {
    flex: 1;
    min-width: 0;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
  }

  .title-line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .name {
    min-width: 0;
    font-family: var(--font-graffiti);
    font-size: 21px;
    line-height: 1.15;
    color: var(--tone);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .src {
    flex-shrink: 0;
    padding: 1px 6px;
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--tone);
    border: 1px solid var(--tone-edge);
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }

  .when {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    min-width: 0;
  }

  .days {
    color: var(--tone);
  }

  .last {
    color: var(--muted);
  }

  .log {
    flex: none;
    width: 76px;
    padding: 0 6px;
    border: 0;
    border-left: 1px solid var(--line);
    background: transparent;
    color: var(--tone);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
  }
</style>
