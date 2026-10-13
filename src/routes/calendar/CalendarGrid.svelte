<script lang="ts">
  import { heatLevel, type CalendarCell, type CellActivity } from '../../lib/calendar/grid';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { TYPE_WORD } from '../../lib/today/day-type';

  /**
   * Calendario di 3 settimane (2c): griglia 3 × 7. Per ogni giorno la sigla delle attività (→ spostata, ✓ fatta,
   * barrata saltata), il rombo del tipo di dieta e, nei giorni passati, i pasti segnati in %. Solo tocco.
   */
  interface Props {
    cells: readonly CalendarCell[];
    selected: string;
    onselect: (date: string) => void;
  }

  let { cells, selected, onselect }: Props = $props();

  const WEEKS = ['Settimana scorsa', 'Questa settimana', 'Settimana prossima'];
  const weeks = $derived([0, 1, 2].map((i) => cells.slice(i * 7, i * 7 + 7)));

  function statusWord(a: CellActivity): string {
    const f = a.kind === 'run';
    if (a.status === 'done') return f ? 'fatta' : 'fatto';
    if (a.status === 'skipped') return f ? 'saltata' : 'saltato';
    if (a.status === 'missed') return f ? 'non fatta' : 'non fatto';
    if (a.status === 'in-progress') return 'in corso';
    return 'in programma';
  }

  function aria(c: CalendarCell): string {
    const acts = c.activities.map((a) => `${a.name}${a.moved ? ' (spostata qui)' : ''}, ${statusWord(a)}`).join('; ') || 'riposo';
    const diet = Object.hasOwn(TYPE_WORD, c.type.key) ? TYPE_WORD[c.type.key] : c.type.label.toLowerCase();
    const meals = c.meals && c.meals.pct !== null ? ` · pasti segnati ${c.meals.pct}%` : '';
    return `${weekdayName(c.weekday)} ${c.dayNumber}${c.isToday ? ', oggi' : ''}: ${acts} · dieta ${diet}${meals}`;
  }
</script>

<div class="weeks" data-testid="calendar-grid">
  {#each weeks as week, w (w)}
    <section class="week" aria-label={WEEKS[w]}>
      <h2 class="mono week-label">{WEEKS[w]}</h2>
      <div class="grid">
        {#each week as c (c.date)}
          <button
            type="button"
            class="cell tap"
            class:today={c.isToday}
            class:past={c.past}
            class:on={c.date === selected}
            aria-pressed={c.date === selected}
            aria-label={aria(c)}
            data-date={c.date}
            onclick={() => onselect(c.date)}
          >
            <span class="head"><span class="initial">{c.initial}</span><span class="num mono">{c.dayNumber}</span></span>
            <span class="acts">
              {#each c.activities.slice(0, 2) as a (a.key)}
                <span class="tag mono {a.kind} {a.status}">{a.moved ? '→' : ''}{a.tag}{a.status === 'done' ? '✓' : ''}</span>
              {/each}
              {#if c.activities.length > 2}<span class="more mono">+{c.activities.length - 2}</span>{/if}
            </span>
            <span class="foot">
              <span class="diamond {c.type.tone}" aria-hidden="true"></span>
              {#if c.meals && c.meals.pct !== null}
                <span class="pct mono heat-{heatLevel(c.meals.pct)}">{c.meals.pct}%</span>
              {/if}
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .weeks {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .week {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .week-label {
    margin: 0;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }

  .cell {
    min-width: 0;
    min-height: 78px;
    padding: 4px 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid transparent;
  }

  .cell.past {
    background: color-mix(in srgb, var(--surface) 70%, transparent);
  }

  .cell.today {
    border-color: var(--progress);
  }

  .cell.on {
    outline: 2px solid var(--text);
    outline-offset: 1px;
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 3px;
  }

  .initial {
    font-size: 10px;
    color: var(--muted);
  }

  .num {
    font-weight: 700;
    font-size: 13px;
  }

  .acts {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-height: 26px;
  }

  .tag {
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    font-size: 9px;
    letter-spacing: 0.5px;
    color: var(--training);
  }

  .tag.run {
    color: var(--progress);
  }

  .tag.skipped {
    text-decoration: line-through;
    color: var(--muted);
  }

  .tag.missed {
    opacity: 0.6;
  }

  .more {
    font-size: 9px;
    color: var(--muted);
  }

  .foot {
    display: flex;
    align-items: center;
    gap: 3px;
    min-height: 12px;
  }

  .diamond {
    width: 6px;
    height: 6px;
    transform: rotate(45deg);
    background: var(--muted);
  }
  .diamond.training {
    background: var(--training);
  }
  .diamond.progress {
    background: var(--progress);
  }

  .pct {
    font-size: 9px;
    color: var(--text-2);
  }
  .pct.heat-80,
  .pct.heat-100 {
    color: var(--food);
  }
</style>
