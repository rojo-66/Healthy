<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import TopBanner from '../../lib/components/TopBanner.svelte';
  import { liveState } from '../../lib/data/live.svelte';
  import { workoutsRepo } from '../../lib/data/repo/workouts';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { slideX } from '../../lib/design/transitions';
  import { edgeSwipe } from '../../lib/sessions/edge-swipe';
  import { beginFlow, flow } from '../../lib/sessions/flow.svelte';
  import { introHref, replaceTo } from '../../lib/sessions/nav';
  import { answeredCount, READINESS_ITEMS, READINESS_MAX, readinessTotal, toReadiness, type ReadinessKey } from '../../lib/sessions/readiness';
  import FlowFooter from './FlowFooter.svelte';
  import FlowSteps from './FlowSteps.svelte';
  import ReadinessQuestion from './ReadinessQuestion.svelte';

  // Passo 1 del flusso (SPEC § 5.4): 5 voci 1–5, "Avanti" solo con tutte le risposte.
  interface Props {
    workoutId: string;
  }

  let { workoutId }: Props = $props();

  untrack(() => beginFlow(workoutId));
  const workout = liveState<Workout | undefined>(() => (workoutId ? workoutsRepo.get(workoutId) : undefined), undefined);

  const total = $derived(readinessTotal(flow.readiness));
  const answered = $derived(answeredCount(flow.readiness));
  const complete = $derived(toReadiness(flow.readiness) !== null);

  function pick(key: ReadinessKey, value: number) {
    flow.readiness = { ...flow.readiness, [key]: value };
  }
</script>

<div class="screen tone-training" in:slideX|global use:edgeSwipe={() => replaceTo('#/allena')}>
  <TopBanner title={workout.current?.name ?? 'Allenamento'} onback={() => replaceTo('#/allena')} backLabel="Annulla e torna indietro">
    <FlowSteps step={1} />
  </TopBanner>

  <main class="body scroll">
    {#if workout.loaded && !workout.current}
      <NoteBox title="Scheda non trovata" mark="!" text="Forse è stata eliminata. Torna ad Allena e scegli un'altra scheda." />
      <Button tone="training" href="#/allena">Torna ad Allena</Button>
    {:else}
      <div class="intro">
        <h2 class="graffiti">Come stai oggi?</h2>
        <p>Le risposte arrivano al tuo PT. Su tutte le voci, 5 = meglio.</p>
      </div>
      {#each READINESS_ITEMS as item (item.key)}
        <ReadinessQuestion {item} value={flow.readiness[item.key]} onpick={(v) => pick(item.key, v)} />
      {/each}
    {/if}
  </main>

  {#if workout.current}
    <FlowFooter>
      <div class="total">
        <span class="mono-label">Readiness</span>
        <span class="mono score" data-testid="readiness-total">{total}<small>/{READINESS_MAX}</small></span>
      </div>
      {#if complete}
        <Button tone="training" size="lg" onclick={() => replaceTo(introHref(workoutId))}>
          Avanti <Icon name="forward" size={18} stroke={2.4} />
        </Button>
      {:else}
        <Button variant="secondary" tone="neutral" disabled>Rispondi a tutte ({answered}/{READINESS_ITEMS.length})</Button>
      {/if}
    </FlowFooter>
  {/if}
</div>

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

  .intro {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .intro h2 {
    font-size: 30px;
    line-height: 1.1;
  }

  .intro p {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .total {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: none !important;
  }

  .total .mono-label {
    font-size: 10px;
  }

  .score {
    font-weight: 700;
    font-size: 22px;
  }

  .score small {
    font-size: 13px;
    color: var(--muted);
  }
</style>
