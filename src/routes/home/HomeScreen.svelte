<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { ValidationError } from '../../lib/data/errors';
  import { liveState } from '../../lib/data/live.svelte';
  import { dietLogBetween, setMealEaten } from '../../lib/data/repo/diet-log';
  import { listDietPlans } from '../../lib/data/repo/diet-plans';
  import { activeSession, sessionsBetween } from '../../lib/data/repo/sessions';
  import { listWorkoutsRecent } from '../../lib/data/repo/workouts';
  import type { DietLogDay } from '../../lib/data/schemas/diet-log';
  import type { DietPlan } from '../../lib/data/schemas/diet-plans';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import type { Session } from '../../lib/data/schemas/sessions';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { addDays, dayMonthYear, fromIsoDate, minutesOfDay, toIsoDate } from '../../lib/diet/calc/calendar';
  import { daySwipe } from '../../lib/design/day-swipe';
  import { rise } from '../../lib/design/transitions';
  import InstallBanner from '../../lib/pwa/InstallBanner.svelte';
  import { buildHomeDay, homeWeek, relativeDayWord, weekDates } from '../../lib/today/home';
  import { syncStatus, type SyncInputs } from '../../lib/today/sync';
  import { readSyncInputs } from '../../lib/today/sync-env';
  import StartGate from '../session/StartGate.svelte';
  import Screen from '../Screen.svelte';
  import CaloriesCard from './CaloriesCard.svelte';
  import DayTimeline from './DayTimeline.svelte';
  import HomeHeader from './HomeHeader.svelte';
  import MealFocusCard from './MealFocusCard.svelte';
  import WelcomeCard from './WelcomeCard.svelte';
  import WorkoutSection from './WorkoutSection.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';

  interface Props {
    now: Date;
  }

  let { now }: Props = $props();

  // Fissati alla creazione: a mezzanotte la Home si ricrea (vedi Home.svelte).
  const todayIso = toIsoDate(untrack(() => now));
  const dates = weekDates(todayIso);
  const nowMinutes = $derived(minutesOfDay(now));

  // --- Dati, tutti dal database locale (si aggiornano da soli quando cambiano) ---
  const plans = liveState<DietPlan[]>(listDietPlans, []);
  const logs = liveState<DietLogDay[]>(() => dietLogBetween(dates[0]!, dates[6]!), []);
  const workouts = liveState<Workout[]>(listWorkoutsRecent, []);
  const sessions = liveState<Session[]>(
    () => sessionsBetween(fromIsoDate(dates[0]!).toISOString(), fromIsoDate(addDays(dates[6]!, 1)).toISOString()),
    [],
  );
  const active = liveState<Session | null>(activeSession, null);

  const loaded = $derived(plans.loaded && logs.loaded && workouts.loaded && sessions.loaded && active.loaded);
  const plan = $derived(plans.current.find((p) => p.active) ?? null);
  const firstRun = $derived(loaded && plans.current.length === 0 && workouts.current.length === 0 && !active.current);

  // --- Giorno mostrato: oggi di default, poi striscia o swipe (solo nella settimana L–D, come la Dieta) ---
  let selected = $state(todayIso);
  const index = $derived(dates.indexOf(selected));

  // Un solo calcolo per giorno: funzioni pure, niente logica nel markup.
  const day = $derived(
    buildHomeDay({
      date: selected,
      todayIso,
      nowMinutes,
      plan,
      log: logs.current.find((l) => l.date === selected),
      workouts: workouts.current,
      sessions: sessions.current,
      active: active.current,
    }),
  );
  const strip = $derived(homeWeek(todayIso, plan, logs.current, workouts.current));

  function select(date: string) {
    if (dates.includes(date)) selected = date;
  }

  let swipeTarget = $state<HTMLDivElement>();

  function onswipe(dir: -1 | 1) {
    const next = dates[index + dir];
    if (next) selected = next;
  }

  // --- Indicatore SYNC OFFLINE: mai un ✓ non vero ---
  let syncInputs = $state<SyncInputs>({ dbOk: null, standalone: false, swControlled: false, persisted: null });
  const sync = $derived(syncStatus(syncInputs));

  onMount(() => {
    let alive = true;
    const refresh = () => {
      void readSyncInputs().then((value) => {
        if (alive) syncInputs = value;
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    // La persistenza viene chiesta all'avvio (main.ts): si ricontrolla poco dopo.
    const later = setTimeout(refresh, 1500);
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener('controllerchange', refresh);
    return () => {
      alive = false;
      clearTimeout(later);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('controllerchange', refresh);
    };
  });

  // --- Azioni ---
  let gate: StartGate;
  let error = $state<readonly string[]>([]);

  async function tick(mealKey: string, eaten: boolean) {
    if (!plan || day.relation !== 'today') return;
    error = [];
    try {
      await setMealEaten(todayIso, plan.id, mealKey, eaten);
    } catch (e) {
      error = e instanceof ValidationError ? e.errors : ['Non sono riuscito a salvare: riprova.'];
    }
  }

  function start(workout: Workout) {
    void gate.request(workout, active.loaded ? active.current : undefined);
  }

  const swapText = $derived(
    day.swapped && day.relation === 'today' ? `Oggi segui il piano di ${weekdayName(day.followsWeekday).toLowerCase()}` : '',
  );
</script>

<Screen nav="oggi">
  <div class="page">
    <InstallBanner />

    <HomeHeader
      dateLabel={dayMonthYear(fromIsoDate(selected))}
      {sync}
      weekday={day.weekday}
      typeLabel={day.dayType.label}
      typeTone={day.dayType.tone}
      {swapText}
      days={strip}
      {selected}
      relative={relativeDayWord(selected, todayIso)}
      onselect={select}
    />

    {#if sync.kind === 'not-saved'}
      <NoteBox title="Dati non disponibili" mark="!">
        <p class="note-text">
          Il telefono non permette di leggere o salvare i dati di Healthy (per esempio in navigazione privata). Apri l’app
          dall’icona in Home.
        </p>
      </NoteBox>
    {/if}

    {#if !loaded}
      <p class="loading">Carico la giornata…</p>
    {:else if firstRun}
      <WelcomeCard />
    {:else}
      <div
        class="days"
        role="group"
        aria-label="Giornata mostrata: scorri a destra o a sinistra per cambiare giorno"
        data-testid="home-swipe"
        use:daySwipe={{ hasPrevious: index > 0, hasNext: index < dates.length - 1, onswipe, target: swipeTarget }}
      >
        <div class="days-inner" bind:this={swipeTarget}>
        <!-- Restano montate cambiando giorno (l'anello non si ricrea): cambiano solo i valori. -->
        {#if day.calories}
          <CaloriesCard calories={day.calories} />
        {:else if !day.hasPlan}
          <Card tone="food" label="Nessun piano alimentare">
            <span class="mono-label kicker-food">● Alimentazione</span>
            <h2 class="empty-title">Nessun piano alimentare</h2>
            <p class="note-text">
              Importa il piano del tuo nutrizionista: qui vedrai il pasto del momento e le calorie della giornata.
            </p>
            <Button tone="food" href="#/dieta">Importa il piano</Button>
          </Card>
        {/if}

        {#if error.length > 0}
          <NoteBox title="Non salvato" mark="!" text={error.join('\n')} />
        {/if}

        <!-- Solo i contenuti del giorno si ricreano, con sola entrata: il vecchio sparisce subito, niente doppioni. -->
        {#key selected}
          <div class="day-content" in:rise>
            {#if day.hasPlan}
              <MealFocusCard focus={day.meal} canTick={day.canTick} ontick={(key, value) => void tick(key, value)} />
            {/if}

            <WorkoutSection
              entries={day.workouts}
              relation={day.relation}
              {nowMinutes}
              conflict={day.conflict}
              hasWorkouts={workouts.current.length > 0}
              onstart={start}
            />

            {#if day.timeline.length > 0}
              <DayTimeline items={day.timeline} />
            {/if}

            <NoteBox title="Tip del giorno" mark="✦">
              <p class="tip">{day.tip.text}</p>
              {#if day.tip.disclaimer}<p class="disclaimer">{day.tip.disclaimer}</p>{/if}
            </NoteBox>
          </div>
        {/key}
        </div>
      </div>
    {/if}
  </div>
</Screen>

<StartGate bind:this={gate} />

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: calc(var(--space-6) + var(--safe-top)) calc(var(--space-5) + var(--safe-right)) var(--space-8)
      calc(var(--space-5) + var(--safe-left));
    background-image:
      radial-gradient(circle at 88% 4%, var(--training-tint), transparent 38%),
      radial-gradient(circle at 6% 30%, color-mix(in srgb, var(--food) 6%, transparent), transparent 32%);
  }

  .days-inner,
  .day-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  /* Ascolta il dito senza muoversi; si sposta solo il contenuto interno. */
  .days {
    touch-action: pan-y;
  }

  .loading {
    margin: 0;
    color: var(--muted);
  }

  .note-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-2);
  }

  .kicker-food {
    font-size: 12px;
    color: var(--tone);
  }

  .empty-title {
    margin: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 26px;
    line-height: 1.1;
  }

  .tip {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
  }

  .disclaimer {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }
</style>
