<script lang="ts">
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { formatInt } from '../../lib/diet/format';
  import type { StripDay } from '../../lib/diet/view';

  interface Props {
    days: readonly StripDay[];
    selected: number;
    today: number;
    onselect: (weekday: number) => void;
  }

  let { days, selected, today, onselect }: Props = $props();

  function kcalText(d: StripDay): string {
    if (d.kcal === null) return '—';
    return (d.complete ? '' : '≥') + formatInt(d.kcal);
  }

  function aria(d: StripDay): string {
    const name = weekdayName(d.weekday) + (d.weekday === today ? ', oggi' : '');
    if (!d.inPlan) return `${name}: non è nel piano`;
    if (d.kcal === null) return `${name}: valori nutrizionali mancanti`;
    return `${name}, ${d.complete ? '' : 'almeno '}${formatInt(d.kcal)} kcal`;
  }
</script>

<div class="strip tone-food" role="group" aria-label="Giorni della settimana" data-testid="day-strip">
  {#each days as d (d.weekday)}
    <button
      type="button"
      class="day tap"
      class:on={d.weekday === selected}
      class:today={d.weekday === today}
      aria-pressed={d.weekday === selected}
      aria-label={aria(d)}
      disabled={!d.inPlan}
      onclick={() => onselect(d.weekday)}
    >
      <span class="initial">{d.initial}</span>
      <span class="diamond {d.typeTone}" aria-hidden="true"></span>
      <span class="kcal mono">{kcalText(d)}</span>
    </button>
  {/each}
</div>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 5px;
  }

  .day {
    min-width: 0;
    min-height: 62px;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 0;
    background: var(--surface);
    color: var(--text);
  }

  /* Oggi: bordo verde (dentro, così non sfora la griglia). */
  .day.today {
    box-shadow: inset 0 0 0 1px var(--tone);
  }

  .day.on {
    background: var(--tone);
    color: var(--on-tone);
    box-shadow: 0 0 14px var(--tone-glow);
  }

  .day:disabled {
    opacity: 0.38;
  }

  .initial {
    font-size: 11px;
    font-weight: 700;
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
  /* Sul pieno verde il grigio si confonde: contorno scuro. */
  .on .diamond {
    outline: 1px solid var(--bg);
  }

  .kcal {
    max-width: 100%;
    font-size: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
  }
</style>
