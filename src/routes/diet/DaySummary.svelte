<script lang="ts">
  import Card from '../../lib/components/Card.svelte';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { TARGET_ORIGIN_LABELS } from '../../lib/diet/calc/targets';
  import { formatDecimal, formatInt } from '../../lib/diet/format';
  import type { DayView } from '../../lib/diet/view';
  import KcalMacros from './KcalMacros.svelte';

  interface Props {
    view: DayView;
    /** Il giorno mostrato è oggi: kcal mangiate / target. Altrimenti kcal del piano / target. */
    today: boolean;
    /** Giorno del calendario mostrato (può differire da `view.weekday` se oggi è scambiato). */
    calendarWeekday: number;
  }

  let { view, today, calendarWeekday }: Props = $props();

  const shown = $derived(today ? view.eatenTotals : view.plan);
  const partial = $derived(!shown.complete);

  const typeTone = $derived(view.typeTone === 'muted' ? 'muted' : view.typeTone);
  const dayFull = $derived(
    weekdayName(calendarWeekday) +
      (today ? ' · oggi' : ' · anteprima') +
      (view.weekday !== calendarWeekday ? ` · piano di ${weekdayName(view.weekday).toLowerCase()}` : ''),
  );
  const planLine = $derived.by(() => {
    const p = view.plan;
    if (!p.complete && p.total.kcal === 0) return 'PIANO — kcal · FIBRE — g';
    const fiberPrefix = p.complete && p.fiberMissing.length === 0 ? '' : '≥ ';
    return `PIANO ${p.complete ? '' : '≥ '}${formatInt(p.total.kcal)} kcal · FIBRE ${fiberPrefix}${formatDecimal(p.total.fiber)} g`;
  });
</script>

<Card tone="food" label="Riepilogo del giorno">
  <div class="head">
    <span class="type mono-label {typeTone}">{view.typeLabel}</span>
    <span class="when">{dayFull}</span>
  </div>
  <!-- Un solo anello, mai ricreato: al cambio giorno cambiano solo i valori. -->
  <KcalMacros {shown} targets={view.resolved?.targets ?? null} mode={today ? 'eaten' : 'plan'} />
  <div class="foot mono">
    <span>{planLine}</span>
    <span class="origin">{view.resolved ? TARGET_ORIGIN_LABELS[view.resolved.origin] : 'TARGET: MANCANTE'}</span>
  </div>
  {#if partial}
    <p class="partial">
      {shown.missing.length === 1 ? 'Un alimento è' : `${shown.missing.length} alimenti sono`} senza valori nutrizionali: i totali
      sono parziali.
    </p>
  {/if}
</Card>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .type {
    font-size: 12px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .type.training {
    color: var(--training);
  }
  .type.progress {
    color: var(--progress);
  }

  .when {
    flex: none;
    font-size: 12px;
    color: var(--muted);
    text-align: right;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    color: var(--muted);
  }

  .origin {
    white-space: nowrap;
  }

  .partial {
    margin: 0;
    font-size: 12px;
    color: var(--tip);
  }
</style>
