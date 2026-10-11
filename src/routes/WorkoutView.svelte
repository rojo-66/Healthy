<script lang="ts">
  import Button from '../lib/components/Button.svelte';
  import NoteBox from '../lib/components/NoteBox.svelte';
  import TopBanner from '../lib/components/TopBanner.svelte';
  import { liveState } from '../lib/data/live.svelte';
  import { workoutsRepo } from '../lib/data/repo/workouts';
  import type { Workout } from '../lib/data/schemas/workouts';
  import { routeHref } from '../lib/routes';
  import ActionBar from './train/ActionBar.svelte';
  import WorkoutPreview from './train/WorkoutPreview.svelte';
  import StartGate from './session/StartGate.svelte';

  // "Vedi scheda": la scheda come la vede chi si allena, in sola lettura.
  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  const workout = liveState<Workout | undefined>(() => (id ? workoutsRepo.get(id) : undefined), undefined);
  let gate: StartGate;
</script>

<div class="screen tone-training">
  <TopBanner title={workout.current?.name ?? 'Scheda'} tone="training" backHref="#/allena" backLabel="Torna alle schede" />

  <div class="body scroll">
    {#if !workout.loaded}
      <p class="hint">Carico la scheda…</p>
    {:else if !workout.current}
      <NoteBox title="Scheda non trovata" mark="!" text="Forse è stata eliminata. Torna all'elenco delle schede." />
      <Button tone="training" href="#/allena">Torna alle schede</Button>
    {:else}
      <WorkoutPreview workout={workout.current} />
    {/if}
  </div>

  {#if workout.current}
    <ActionBar>
      <Button variant="secondary" tone="neutral" href={routeHref('/allena/editor', { id: workout.current.id })}>Modifica</Button>
      <Button tone="training" size="lg" onclick={() => workout.current && void gate.request(workout.current)}>Avvia</Button>
    </ActionBar>
  {/if}
</div>

<StartGate bind:this={gate} />

<style>
  .screen {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background-image: radial-gradient(circle at 90% 8%, var(--tone-tint), transparent 40%);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4) calc(var(--space-5) + var(--safe-right)) calc(120px + var(--safe-bottom))
      calc(var(--space-5) + var(--safe-left));
  }

  .hint {
    color: var(--muted);
  }
</style>
