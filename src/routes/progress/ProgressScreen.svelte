<script lang="ts">
  import { untrack } from 'svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import Tabs from '../../lib/components/Tabs.svelte';
  import type { Tone } from '../../lib/components/types';
  import { liveState } from '../../lib/data/live.svelte';
  import { dietLogRepo } from '../../lib/data/repo/diet-log';
  import { listDietPlans } from '../../lib/data/repo/diet-plans';
  import { listMeasurementsByDate } from '../../lib/data/repo/measurements';
  import { getProfile } from '../../lib/data/repo/profile';
  import { completedSessions } from '../../lib/data/repo/sessions';
  import { getNextMeasurement } from '../../lib/data/repo/settings';
  import { workoutsRepo } from '../../lib/data/repo/workouts';
  import type { DietLogDay } from '../../lib/data/schemas/diet-log';
  import type { DietPlan } from '../../lib/data/schemas/diet-plans';
  import type { Measurement } from '../../lib/data/schemas/measurements';
  import type { Profile } from '../../lib/data/schemas/profile';
  import type { Session } from '../../lib/data/schemas/sessions';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { toIsoDate } from '../../lib/diet/calc/calendar';
  import { bodySeries } from '../../lib/progress/body';
  import { strengthIndex } from '../../lib/progress/strength';
  import { spanLine } from '../../lib/progress/format';
  import { dataSpan, periodRange, PERIODS } from '../../lib/progress/period';
  import { parseTab, PROGRESS_TABS, progressView, type ProgressTab } from '../../lib/progress/state.svelte';
  import { sessionDate } from '../../lib/sessions/calendar';
  import Screen from '../Screen.svelte';
  import BodyTab from './BodyTab.svelte';
  import DietTab from './DietTab.svelte';
  import StrengthTab from './StrengthTab.svelte';

  /**
   * Progressi (SPEC § 5.7): sola lettura. Legge misure, sessioni, schede, piani e diario dal database
   * del telefono (anche offline) e li mostra nel tempo. I calcoli pesanti dipendono solo dai dati
   * (si rifanno quando cambiano); periodo, tab ed esercizio filtrano risultati già pronti.
   */
  interface Props {
    now: Date;
    tab: string | null;
  }

  let { now, tab }: Props = $props();

  // La tab chiesta dall'indirizzo vale all'apertura; poi restano le scelte della sessione.
  const requested = untrack(() => parseTab(tab));
  if (requested) progressView.tab = requested;

  const TAB_TONE: Record<ProgressTab, Tone> = { corpo: 'progress', forza: 'training', dieta: 'food' };

  const profile = liveState<Profile | undefined>(getProfile, undefined);
  const measurements = liveState<Measurement[]>(listMeasurementsByDate, []);
  const next = liveState(getNextMeasurement, { text: '', date: null });
  const sessions = liveState<Session[]>(completedSessions, []);
  const workouts = liveState<Workout[]>(() => workoutsRepo.list(), []);
  const plans = liveState<DietPlan[]>(listDietPlans, []);
  const logs = liveState<DietLogDay[]>(() => dietLogRepo.list(), []);
  const sources = [profile, measurements, next, sessions, workouts, plans, logs];

  const loaded = $derived(sources.every((s) => s.loaded));
  const failed = $derived(sources.some((s) => s.error));

  const today = $derived(toIsoDate(now));
  const sessionDates = $derived(sessions.current.map(sessionDate));
  const span = $derived(
    dataSpan([...measurements.current.map((m) => m.date), ...sessionDates, ...logs.current.map((l) => l.date)], today),
  );
  // Ogni tab parte dal suo primo dato: le misure per Corpo, le sessioni per Forza.
  const firstSession = $derived(sessionDates.reduce<string | null>((min, d) => (min === null || d < min ? d : min), null));
  const bodyRange = $derived(periodRange(progressView.period, today, measurements.current[0]?.date ?? null));
  const strengthRange = $derived(periodRange(progressView.period, today, firstSession));

  // Corpo: serie calcolate solo quando cambiano misure o profilo.
  const body = $derived(bodySeries(measurements.current, profile.current));
  // Forza: indice per esercizio (serie migliori, volumi, record) calcolato solo quando cambiano le sessioni.
  const strength = $derived(strengthIndex(sessions.current));
  const tone = $derived(TAB_TONE[progressView.tab]);
</script>

<Screen nav="progressi">
  <div class="page tone-{tone}">
    <header class="top">
      <span class="mono span" data-testid="progress-span">{loaded ? spanLine(span) : ' '}</span>
      <h1 class="graffiti title">Progressi</h1>
    </header>

    {#if progressView.tab !== 'dieta'}
      <div class="periods" role="group" aria-label="Periodo">
        {#each PERIODS as p (p.key)}
          <button
            type="button"
            class="period tap"
            aria-pressed={progressView.period === p.key}
            onclick={() => (progressView.period = p.key)}>{p.label}</button
          >
        {/each}
      </div>
    {/if}

    <Tabs tabs={PROGRESS_TABS} bind:selected={progressView.tab} label="Sezioni" {tone}>
      {#snippet panel(id)}
        {#if failed}
          <NoteBox title="Dati non disponibili" mark="!" text="Non riesco a leggere i dati su questo telefono." />
        {:else if !loaded}
          <p class="hint">Carico i dati…</p>
        {:else if id === 'corpo'}
          <BodyTab series={body} range={bodyRange} goal={profile.current?.goal ?? null} next={next.current} {today} />
        {:else if id === 'forza'}
          <StrengthTab index={strength} sessions={sessions.current} workouts={workouts.current} range={strengthRange} {today} />
        {:else}
          <DietTab plans={plans.current} logs={logs.current} {today} />
        {/if}
      {/snippet}
    </Tabs>
  </div>
</Screen>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-width: 0;
    max-width: 560px;
    margin: 0 auto;
    padding: calc(54px + var(--safe-top)) calc(var(--space-5) + var(--safe-right)) var(--space-8)
      calc(var(--space-5) + var(--safe-left));
    background-image: radial-gradient(circle at 90% 4%, var(--tone-tint), transparent 38%);
    background-repeat: no-repeat;
    background-size: 100% 600px;
  }

  .top {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .span {
    min-height: 1.4em;
    font-size: 12px;
    letter-spacing: 1.5px;
    line-height: 1.4;
    color: var(--muted);
  }

  .title {
    font-size: 54px;
    line-height: 1;
    color: var(--progress);
    text-shadow: 0 0 18px var(--progress-glow);
    transform: rotate(-3deg);
    transform-origin: left bottom;
  }

  .periods {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .period {
    height: var(--touch);
    min-width: 0;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
  }

  .period[aria-pressed='true'] {
    border-color: var(--progress);
    background: var(--progress-tint);
    color: var(--progress);
  }

  .hint {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
  }
</style>
