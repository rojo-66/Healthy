<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import { routeHref } from '../../lib/routes';
  import type { NextWorkout } from '../../lib/workouts/calc/week';
  import { nextMeta, relativeDay, weekdayShort } from '../../lib/workouts/format';

  interface Props {
    next: NextWorkout;
    onstart: () => void;
  }

  let { next, onstart }: Props = $props();
</script>

<Card tone="training" label="Prossimo allenamento">
  <div class="top">
    <span class="mono-label kicker">▲ Prossimo · {weekdayShort(next.weekday)}</span>
    <span class="when">{relativeDay(next.inDays)}</span>
  </div>
  <h2 class="name">{next.workout.name}</h2>
  <span class="mono meta">{nextMeta(next.workout)}</span>
  <div class="actions">
    <Button tone="training" size="lg" onclick={onstart}>Avvia</Button>
    <Button variant="secondary" tone="neutral" href={routeHref('/allena/vedi', { id: next.workout.id })}>Vedi scheda</Button>
  </div>
</Card>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .kicker {
    color: var(--tone);
    font-size: 12px;
  }

  .when {
    font-size: 12px;
    color: var(--muted);
  }

  .name {
    margin: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 32px;
    line-height: 1.05;
    color: var(--tone);
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: 13px;
    color: var(--text-2);
  }

  .actions {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .actions :global(.btn) {
    min-height: 50px;
  }
</style>
