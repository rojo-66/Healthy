<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { ValidationError } from '../../lib/data/errors';
  import { setMealEaten } from '../../lib/data/repo/diet-log';
  import type { Run, RunLog } from '../../lib/data/schemas/runs';
  import type { RunEntry } from '../../lib/today/workout-day';
  import RunLogSheet from '../train/RunLogSheet.svelte';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { addDays, dayMonthYear, fromIsoDate, minutesOfDay, toIsoDate, weekStartOf } from '../../lib/diet/calc/calendar';
  import { swipe } from '../../lib/design/swipe-action';
  import { rise } from '../../lib/design/transitions';
  import InstallBanner from '../../lib/pwa/InstallBanner.svelte';
  import { dayInfos, sourceOf } from '../../lib/calendar/days';
  import { liveCalendar } from '../../lib/calendar/live.svelte';
  import { calendarWindow, datesBetween } from '../../lib/calendar/occurrences';
  import { buildHomeDay, homeStrip, relativeDayWord } from '../../lib/today/home';
  import { syncStatus, type SyncInputs } from '../../lib/today/sync';
  import { readSyncInputs } from '../../lib/today/sync-env';
  import CalendarActions from '../calendar/CalendarActions.svelte';
  import DietChoice from '../calendar/DietChoice.svelte';
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
  // 2c: settimana scorsa, questa e prossima (la striscia scorre tra le tre).
  const win = calendarWindow(todayIso);
  const dates = datesBetween(win.from, win.to);
  const nowMinutes = $derived(minutesOfDay(now));

  // --- Dati, tutti dal database locale (si aggiornano da soli quando cambiano) ---
  const cal = liveCalendar(win.from, win.to);
  const loaded = $derived(cal.loaded);
  const plan = $derived(cal.plan);
  const firstRun = $derived(loaded && cal.plans.length === 0 && cal.workouts.length === 0 && cal.runs.length === 0 && !cal.active);
  const input = $derived(cal.input(todayIso));
  /** Tipo di giornata, diario e attività dei 21 giorni (un calcolo solo). */
  const all = $derived(dayInfos(win.from, win.to, input, cal.diet));

  // --- Giorno mostrato: oggi di default, poi striscia o swipe (nelle 3 settimane) ---
  let selected = $state(todayIso);
  const index = $derived(dates.indexOf(selected));
  const info = $derived(all.infos[index]!);

  // Un solo calcolo per giorno: funzioni pure, niente logica nel markup.
  const day = $derived(
    buildHomeDay({ todayIso, nowMinutes, plan, info, days: all.days, workouts: cal.workouts, active: cal.active }),
  );

  // --- Settimana della striscia ---
  const weekIndex = $derived(win.weeks.indexOf(weekStartOf(fromIsoDate(selected))));
  const strip = $derived(homeStrip(all.infos.slice(weekIndex * 7, weekIndex * 7 + 7), todayIso));
  const WEEK_LABELS = ['Settimana scorsa', 'Questa settimana', 'Settimana prossima'];
  const canWeek = (dir: -1 | 1) => weekIndex + dir >= 0 && weekIndex + dir <= 2;
  /** Settimana prima o dopo: stesso giorno della settimana. */
  function onweek(dir: -1 | 1) {
    if (canWeek(dir)) selected = addDays(selected, dir * 7);
  }

  // --- Corsa (2a): "Segna come fatta" per il giorno mostrato, dettaglio di una corsa fatta ---
  let runSheetOpen = $state(false);
  let sheetRun = $state.raw<Run | null>(null);
  let sheetLog = $state.raw<RunLog | null>(null);
  let sheetDate = $state(todayIso);
  let runStatus = $state('');

  function logRun(entry: RunEntry) {
    sheetRun = entry.run;
    sheetLog = null;
    sheetDate = selected <= todayIso ? selected : todayIso;
    runStatus = '';
    runSheetOpen = true;
  }

  function showRun(log: RunLog) {
    sheetRun = cal.runs.find((r) => r.id === log.runId) ?? null;
    sheetLog = log;
    runStatus = '';
    runSheetOpen = true;
  }

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
    if (!plan || day.relation !== 'today' || !day.view) return;
    error = [];
    try {
      // La fonte del pasto (giorno e variante di adesso): se poi il tipo di giornata cambia, resta com'era.
      await setMealEaten(todayIso, plan.id, mealKey, eaten, sourceOf(day.view));
    } catch (e) {
      error = e instanceof ValidationError ? e.errors : ['Non sono riuscito a salvare: riprova.'];
    }
  }

  function start(workout: Workout) {
    void gate.request(workout, loaded ? cal.active : undefined);
  }

  let actions: CalendarActions;
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
      days={strip}
      weekLabel={WEEK_LABELS[weekIndex] ?? ''}
      {canWeek}
      {onweek}
      {selected}
      {todayIso}
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
        use:swipe={{ canGo: (dir) => dates[index + dir] !== undefined, onswipe, target: swipeTarget }}
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

            {#if day.dayType.double}
              <DietChoice date={day.date} {todayIso} current={day.dayType.key} />
            {/if}

            <WorkoutSection
              entries={day.workouts}
              runs={day.runs}
              relation={day.relation}
              {nowMinutes}
              note={day.typeNote}
              hasWorkouts={cal.workouts.length > 0 || cal.runs.length > 0}
              onstart={start}
              onlogrun={logRun}
              onshowrun={showRun}
              onmanage={(o) => actions.openMenu(o)}
              onrestore={(o) => actions.restore(o)}
            />
            {#if runStatus}<p class="run-status" role="status">{runStatus}</p>{/if}

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
<CalendarActions bind:this={actions} {input} diet={cal.diet} />
<RunLogSheet
  bind:open={runSheetOpen}
  run={sheetRun}
  log={sheetLog}
  date={sheetDate}
  today={todayIso}
  onsaved={(m) => (runStatus = m)}
/>

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

  .loading {
    margin: 0;
    color: var(--muted);
  }

  .run-status {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
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
