<script lang="ts">
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { fromIsoDate, WEEKDAY_INITIALS } from '../../lib/diet/calc/calendar';
  import type { WeekDay } from '../../lib/workouts/calc/week';
  import { dayStateLabel } from './day-state';

  interface Props {
    days: readonly WeekDay[];
    selected: number;
    /** Giorni da oggi al prossimo allenamento (per "OGGI"/"DOMANI"). */
    nextInDays: number | null;
    onselect: (weekday: number) => void;
  }

  let { days, selected, nextInDays, onselect }: Props = $props();

  function aria(d: WeekDay): string {
    const names =
      d.occurrences
        .map((o) => `${o.kind === 'run' ? 'corsa ' : ''}${o.name}${o.moved ? ' (spostata qui)' : ''}${o.skipped ? ' (saltata)' : ''}`)
        .join(', ') || 'riposo';
    const today = d.isToday ? ', oggi' : '';
    return `${weekdayName(d.weekday)} ${fromIsoDate(d.date).getDate()}${today}: ${names} · ${dayStateLabel(d.state, nextInDays).toLowerCase()}`;
  }
</script>

<div class="strip tone-training" role="group" aria-label="La tua settimana" data-testid="week-strip">
  {#each days as d (d.weekday)}
    <button
      type="button"
      class="day tap {d.state}"
      class:tone-progress={d.tagKind === 'run'}
      class:on={d.weekday === selected}
      aria-pressed={d.weekday === selected}
      aria-label={aria(d)}
      onclick={() => onselect(d.weekday)}
    >
      <span class="letter">{WEEKDAY_INITIALS[d.weekday - 1]}</span>
      <span class="mark mono">{d.state === 'done' ? '✓' : fromIsoDate(d.date).getDate()}</span>
      <span class="tag mono">{d.movedIn ? '→' : ''}{d.tag}</span>
    </button>
  {/each}
</div>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }

  .day {
    min-width: 0;
    min-height: 64px;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--surface);
  }

  .letter {
    font-size: 11px;
    opacity: 0.85;
  }

  .mark {
    font-weight: 700;
    font-size: 14px;
  }

  .tag {
    max-width: 100%;
    overflow: hidden;
    font-size: 9px;
    letter-spacing: 1px;
    opacity: 0.85;
  }

  /* Fatto: pieno magenta. */
  .done {
    background: var(--tone);
    color: var(--on-tone);
    border-color: var(--tone);
  }

  /* Prossimo: contorno luminoso. */
  .next {
    border-color: var(--tone);
    box-shadow: 0 0 12px var(--tone-glow);
  }

  /* Fatto in parte: contorno pieno, sfondo tenue. */
  .partial {
    border-color: var(--tone);
    background: var(--tone-tint);
  }

  /* Saltato: sigla barrata. */
  .skipped {
    color: var(--muted);
  }
  .skipped .tag {
    text-decoration: line-through;
  }

  /* Non fatto: grigio attenuato. */
  .missed {
    color: var(--muted);
    background: color-mix(in srgb, var(--surface) 60%, transparent);
  }

  /* Riposo: tratteggiato. */
  .rest {
    background: transparent;
    color: var(--muted);
    border: 1px dashed var(--line);
  }

  .on {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }
</style>
