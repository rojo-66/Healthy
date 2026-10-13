<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import type { CalendarCell } from '../../lib/calendar/grid';
  import { shortDay } from '../../lib/calendar/move';
  import type { Occurrence } from '../../lib/calendar/occurrences';
  import type { DayInfo } from '../../lib/calendar/days';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { MONTHS } from '../../lib/diet/calc/calendar';
  import { formatInt } from '../../lib/diet/format';
  import type { DayView } from '../../lib/diet/view';
  import { missingTypeText } from '../../lib/today/day-type';
  import DietChoice from './DietChoice.svelte';

  /**
   * Dettaglio del giorno toccato nel calendario (2c): tipo di dieta, kcal, attività con Sposta, Salta e Ripristina,
   * scelta della dieta nei giorni con palestra e corsa.
   */
  interface Props {
    info: DayInfo;
    cell: CalendarCell;
    view: DayView | null;
    todayIso: string;
    /** Attività fatte fuori programma quel giorno (nomi). */
    extras: readonly string[];
    onmove: (o: Occurrence) => void;
    onskip: (o: Occurrence) => void;
    onrestore: (o: Occurrence) => void;
    canMove: (o: Occurrence) => boolean;
  }

  let { info, cell, view, todayIso, extras, onmove, onskip, onrestore, canMove }: Props = $props();

  const title = $derived(
    `${weekdayName(info.weekday)} ${cell.dayNumber} ${(MONTHS[Number(info.date.slice(5, 7)) - 1] ?? '').toLowerCase()}`,
  );
  const target = $derived(view?.resolved?.targets.kcal ?? null);
  const note = $derived(missingTypeText(info.type));

  function statusText(o: Occurrence): string {
    const f = o.kind === 'run' ? 'a' : 'o';
    switch (o.status) {
      case 'done':
        return `fatt${f} ✓`;
      case 'in-progress':
        return 'in corso';
      case 'skipped':
        return `saltat${f}`;
      case 'missed':
        return `non fatt${f}`;
      default:
        return 'in programma';
    }
  }
</script>

<section class="detail" aria-labelledby="day-title" data-testid="calendar-detail">
  <div class="head">
    <h2 id="day-title" class="graffiti title">{title}</h2>
    <span class="badge"><span class="diamond {info.type.tone}" aria-hidden="true"></span>{info.type.label}</span>
  </div>

  {#if view}
    <p class="kcal mono" data-testid="detail-kcal">
      {#if cell.meals}
        {formatInt(cell.meals.kcal)}{target !== null ? ` / ${formatInt(target)}` : ''} kcal · pasti {cell.meals.eaten}/{cell.meals.planned}
      {:else}
        Piano: {formatInt(view.plan.total.kcal)} kcal{target !== null ? ` · target ${formatInt(target)}` : ''}
      {/if}
    </p>
  {/if}
  {#if note}<p class="note">{note}</p>{/if}

  {#if info.type.double}
    <DietChoice date={info.date} {todayIso} current={info.type.key} />
  {/if}

  <ul class="acts">
    {#each info.occurrences as o (o.key)}
      <li class="act {o.kind}" class:skipped={o.skipped}>
        <div class="act-text">
          <span class="kicker mono">{o.kind === 'run' ? '● Corsa' : '▲ Palestra'} · {statusText(o)}</span>
          <span class="name">{o.name}</span>
          {#if o.moved}<span class="moved">Spostat{o.kind === 'run' ? 'a' : 'o'} da {shortDay(o.originalDate)}</span>{/if}
        </div>
        <div class="buttons">
          {#if canMove(o) && !o.skipped}
            <Button size="sm" variant="secondary" tone={o.kind === 'run' ? 'progress' : 'training'} onclick={() => onmove(o)}>Sposta</Button>
            <Button size="sm" variant="ghost" onclick={() => onskip(o)}>Salta</Button>
          {/if}
          {#if o.moved || o.skipped}
            <Button size="sm" variant="ghost" onclick={() => onrestore(o)}>Ripristina</Button>
          {/if}
        </div>
      </li>
    {/each}
    {#each extras as name, i (i)}
      <li class="act">
        <div class="act-text">
          <span class="kicker mono">Fuori programma · fatto ✓</span>
          <span class="name">{name}</span>
        </div>
      </li>
    {/each}
    {#if info.occurrences.length === 0 && extras.length === 0}
      <li class="rest">Nessuna attività: giorno di riposo.</li>
    {/if}
  </ul>
</section>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--surface);
    border: 1px solid var(--line);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .title {
    margin: 0;
    font-size: 26px;
    line-height: 1.1;
    color: var(--progress);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid var(--line-strong);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .diamond {
    width: 7px;
    height: 7px;
    transform: rotate(45deg);
    background: var(--muted);
  }
  .diamond.training {
    background: var(--training);
  }
  .diamond.progress {
    background: var(--progress);
  }

  .kcal {
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
  }

  .note {
    margin: 0;
    padding: 8px 10px;
    border: 1px dashed var(--tip-edge);
    background: var(--tip-tint);
    color: var(--tip);
    font-size: 13px;
  }

  .acts {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .act {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--line);
  }

  .act-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kicker {
    font-size: 11px;
    color: var(--training);
  }
  .act.run .kicker {
    color: var(--progress);
  }

  .name {
    font-weight: 700;
    font-size: 16px;
    overflow-wrap: anywhere;
  }

  .act.skipped .name {
    text-decoration: line-through;
    color: var(--muted);
  }

  .moved {
    font-size: 12px;
    color: var(--muted);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .rest {
    font-size: 14px;
    color: var(--muted);
  }
</style>
