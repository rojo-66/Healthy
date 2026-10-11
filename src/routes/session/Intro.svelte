<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import TopBanner from '../../lib/components/TopBanner.svelte';
  import { ValidationError } from '../../lib/data/errors';
  import { newId } from '../../lib/data/ids';
  import { liveState } from '../../lib/data/live.svelte';
  import { ActiveSessionError, lastCompletedForWorkout, startSession } from '../../lib/data/repo/sessions';
  import { workoutsRepo } from '../../lib/data/repo/workouts';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { slideX } from '../../lib/design/transitions';
  import { edgeSwipe } from '../../lib/sessions/edge-swipe';
  import { beeper } from '../../lib/sessions/audio';
  import { buildSession } from '../../lib/sessions/create';
  import { beginFlow, clearFlow, flow } from '../../lib/sessions/flow.svelte';
  import { exercisesLabel } from '../../lib/sessions/format';
  import { liveHref, readinessHref, replaceTo } from '../../lib/sessions/nav';
  import { toReadiness } from '../../lib/sessions/readiness';
  import { keepAwake } from '../../lib/sessions/wake-lock';
  import { workoutTotals } from '../../lib/workouts/calc/duration';
  import FlowFooter from './FlowFooter.svelte';
  import FlowSteps from './FlowSteps.svelte';
  import StartGate from './StartGate.svelte';

  // Passo 2 del flusso: riepilogo, messaggio del PT, riscaldamento spuntabile, "Inizia allenamento".
  interface Props {
    workoutId: string;
  }

  let { workoutId }: Props = $props();

  untrack(() => beginFlow(workoutId));
  const workout = liveState<Workout | undefined>(() => (workoutId ? workoutsRepo.get(workoutId) : undefined), undefined);

  // Senza risposte (app riaperta su questa pagina) si torna al Readiness.
  onMount(() => {
    if (!toReadiness(flow.readiness)) replaceTo(readinessHref(workoutId));
  });

  const totals = $derived(workout.current ? workoutTotals(workout.current) : null);
  const warmupDone = $derived(flow.warmup.filter(Boolean).length);

  function toggleWarmup(i: number) {
    const next = [...flow.warmup];
    next[i] = !next[i];
    flow.warmup = next;
  }

  let gate: StartGate;
  let starting = $state(false);
  let error = $state('');

  async function start(w: Workout) {
    // Primo gesto della sessione: sblocca l'audio e chiede lo schermo sempre acceso (prima di ogni attesa).
    beeper.unlock();
    void keepAwake().start();
    const readiness = toReadiness(flow.readiness);
    if (!readiness) return replaceTo(readinessHref(w.id));
    starting = true;
    error = '';
    try {
      const previous = await lastCompletedForWorkout(w.id);
      const session = buildSession({ id: newId(), workout: $state.snapshot(w), readiness, previous, now: new Date() });
      await startSession(session);
      clearFlow();
      replaceTo(liveHref(session.id));
    } catch (e) {
      keepAwake().stop();
      if (e instanceof ActiveSessionError) gate.conflict(e.active, w);
      else error = e instanceof ValidationError ? e.errors.join(' ') : 'Non sono riuscito a iniziare l’allenamento.';
    } finally {
      starting = false;
    }
  }
</script>

<div class="screen tone-training" in:slideX|global use:edgeSwipe={() => replaceTo(readinessHref(workoutId))}>
  <TopBanner
    title={workout.current?.name ?? 'Allenamento'}
    onback={() => replaceTo(readinessHref(workoutId))}
    backLabel="Torna al readiness"
  >
    <FlowSteps step={2} />
  </TopBanner>

  <main class="body scroll">
    {#if workout.loaded && !workout.current}
      <NoteBox title="Scheda non trovata" mark="!" text="Forse è stata eliminata. Torna ad Allena e scegli un'altra scheda." />
      <Button tone="training" href="#/allena">Torna ad Allena</Button>
    {:else if workout.current && totals}
      {@const w = workout.current}
      <div class="chips mono" data-testid="intro-chips">
        <span>{exercisesLabel(totals.exercises)}</span>
        <span>{totals.sets} serie</span>
        {#if w.cardio && w.cardio.minutes > 0}<span>+ {w.cardio.minutes}’ {w.cardio.type}</span>{/if}
      </div>

      {#if w.intro}
        <NoteBox title="Dal tuo PT" text={w.intro} />
      {/if}

      {#if w.warmup.length > 0}
        <section class="warmup" aria-labelledby="warmup-title">
          <div class="warm-head">
            <h3 id="warmup-title" class="mono-label">Riscaldamento e mobilità</h3>
            <span class="mono count">{warmupDone}/{w.warmup.length}</span>
          </div>
          {#each w.warmup as item, i (i)}
            {@const on = flow.warmup[i] === true}
            <button type="button" class="warm tap" class:on aria-pressed={on} onclick={() => toggleWarmup(i)}>
              <span class="box" aria-hidden="true">
                <span class="box-fill"></span>
                <Icon name="check" size={14} stroke={3.2} />
              </span>
              <span class="warm-text">
                <span class="warm-name">{item.name}</span>
                {#if item.hint}<span class="warm-hint">{item.hint}</span>{/if}
              </span>
              {#if item.dose}<span class="mono dose">{item.dose}</span>{/if}
            </button>
          {/each}
        </section>
      {/if}

      {#if error}<p class="error" role="alert">{error}</p>{/if}
    {/if}
  </main>

  {#if workout.current}
    {@const w = workout.current}
    <FlowFooter>
      <Button tone="training" size="lg" disabled={starting} onclick={() => void start(w)}>
        <Icon name="play" size={16} /> Inizia allenamento
      </Button>
    </FlowFooter>
  {/if}
</div>

<StartGate bind:this={gate} onrestart={() => workout.current && void start(workout.current)} />

<style>
  .screen {
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
    gap: var(--space-5);
    padding: var(--space-5) calc(var(--space-5) + var(--safe-right)) var(--space-6) calc(var(--space-5) + var(--safe-left));
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-size: 12px;
  }

  .chips span {
    padding: 6px 10px;
    border: 1px solid var(--line-strong);
    color: var(--text-2);
  }

  .warmup {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .warm-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .warm-head h3 {
    margin: 0;
    font-size: 12px;
  }

  .count {
    font-size: 12px;
    color: var(--training);
  }

  .warm {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 60px;
    padding: var(--space-3) 14px;
    border: 0;
    background: var(--surface);
    color: var(--text);
    text-align: left;
  }

  /* Fatto: tinta magenta e testo più tenue, solo con opacity. */
  .warm::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--training-tint);
    opacity: 0;
    transition: opacity var(--dur-fade) ease;
  }

  .warm.on::before {
    opacity: 1;
  }

  .warm-text,
  .dose {
    transition: opacity var(--dur-fade) ease;
  }

  .warm.on .warm-text,
  .warm.on .dose {
    opacity: 0.75;
  }

  .box {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 1px solid var(--line-strong);
    color: transparent;
  }

  .box-fill {
    position: absolute;
    inset: -1px;
    background: var(--training);
    transform: scale(0);
    transition: transform var(--dur-ind) var(--spring);
  }

  .on .box {
    color: var(--on-tone);
  }

  .on .box-fill {
    transform: scale(1);
  }

  .box :global(svg) {
    position: relative;
  }

  .warm-text {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .warm-name {
    font-size: 15px;
    font-weight: 700;
  }

  .warm-hint {
    font-size: 12px;
    color: var(--muted);
  }

  .dose {
    position: relative;
    flex: none;
    font-size: 13px;
    color: var(--text-2);
  }

  .error {
    margin: 0;
    color: var(--tip);
    font-size: 14px;
  }
</style>
