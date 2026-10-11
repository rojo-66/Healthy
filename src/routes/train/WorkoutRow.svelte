<script lang="ts">
  import Icon from '../../lib/components/Icon.svelte';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { lastRunLabel, originLabel, weekdaysLabel, workoutMeta } from '../../lib/workouts/format';

  interface Props {
    workout: Workout;
    /** Inizio dell'ultima sessione conclusa (M5), `null` se mai eseguita. */
    lastRun: string | null;
    onopen: () => void;
    onshare: () => void;
  }

  let { workout, lastRun, onopen, onshare }: Props = $props();
</script>

<div class="row tone-training" data-testid="workout-row">
  <button
    type="button"
    class="main tap"
    aria-haspopup="dialog"
    aria-label="{workout.name}: {originLabel(workout)}, {workoutMeta(workout)}. Apri le azioni"
    onclick={onopen}
  >
    <span class="title-line">
      <span class="name">{workout.name}</span>
      <span class="src mono" class:pt={workout.source === 'pt'}>{originLabel(workout)}</span>
    </span>
    <span class="meta mono">{workoutMeta(workout)}</span>
    <span class="when">
      <span class="days mono">{weekdaysLabel(workout.weekdays)}</span>
      <span class="last">{lastRunLabel(lastRun)}</span>
    </span>
  </button>
  <button type="button" class="share tap" aria-label="Condividi {workout.name}" onclick={onshare}>
    <Icon name="share" size={18} />
  </button>
</div>

<style>
  .row {
    display: flex;
    align-items: stretch;
    background: var(--surface);
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
    width: 100%;
    min-width: 0;
  }

  .name {
    min-width: 0;
    font-family: var(--font-graffiti);
    font-size: 21px;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .src {
    flex-shrink: 0;
    padding: 1px 6px;
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--muted);
    border: 1px solid var(--line-strong);
  }

  .src.pt {
    color: var(--tip);
    border-color: var(--tip-edge);
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
    padding: 2px 8px;
    background: var(--bg);
    font-weight: 700;
    color: var(--tone);
    white-space: nowrap;
  }

  .last {
    color: var(--muted);
    white-space: nowrap;
  }

  .share {
    width: 52px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-left: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
  }
</style>
