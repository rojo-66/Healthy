<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import TopBanner from '../../lib/components/TopBanner.svelte';
  import { formatClock } from '../../lib/components/time';
  import { downloadFile } from '../../lib/data/deliver-file';
  import { liveState } from '../../lib/data/live.svelte';
  import { completedSessions, deleteSession, sessionsRepo } from '../../lib/data/repo/sessions';
  import type { Session } from '../../lib/data/schemas/sessions';
  import { headerDate, isoWeekday, minutesOfDay, toIsoDate } from '../../lib/diet/calc/calendar';
  import { pop, slideX } from '../../lib/design/transitions';
  import { edgeSwipe } from '../../lib/sessions/edge-swipe';
  import { cardioDoneLabel, exercisesLabel, timeRange, volumeLabel } from '../../lib/sessions/format';
  import { historyHref, liveHref, replaceTo } from '../../lib/sessions/nav';
  import { nextMeal } from '../../lib/sessions/next-meal';
  import { dayInfo } from '../../lib/calendar/days';
  import { buildCalendar } from '../../lib/calendar/occurrences';
  import { liveCalendar } from '../../lib/calendar/live.svelte';
  import { READINESS_ITEMS, READINESS_MAX } from '../../lib/sessions/readiness';
  import { sessionExportFile, sessionText, shareSession } from '../../lib/sessions/share';
  import { summarize } from '../../lib/sessions/summary';
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import ConfirmSheet from '../train/ConfirmSheet.svelte';
  import ExerciseSummary from './ExerciseSummary.svelte';
  import NextMealCard from './NextMealCard.svelte';
  import RpePicker from './RpePicker.svelte';

  // Riepilogo (SPEC § 5.4 punto 4): sempre riapribile dallo Storico.
  interface Props {
    id: string;
    /** Aperto dallo Storico: "Fine" torna lì invece che alla Home. */
    fromHistory: boolean;
  }

  let { id, fromHistory }: Props = $props();

  const session = liveState<Session | undefined | null>(() => (id ? sessionsRepo.get(id) : undefined), null);
  const all = liveState<Session[]>(completedSessions, []);
  const todayIso = toIsoDate(new Date());
  // Piano, diario e attività di oggi: il prossimo pasto segue il tipo di giornata (2c).
  const cal = liveCalendar(todayIso, todayIso);
  const today = $derived.by(() => {
    const input = cal.input(todayIso);
    return dayInfo(todayIso, buildCalendar(todayIso, todayIso, input), input, cal.diet);
  });

  // Una sessione ancora in corso non ha riepilogo: torna al Live.
  $effect(() => {
    const s = session.current;
    if (s && s.endedAt === null) replaceTo(liveHref(s.id));
  });

  const done = $derived(session.current && session.current.endedAt !== null ? session.current : null);
  /** Ultima sessione conclusa con la stessa scheda, prima di questa. */
  const previous = $derived.by(() => {
    if (!done) return null;
    const before = all.current.filter((s) => s.workoutId === done.workoutId && s.startedAt < done.startedAt);
    return before[before.length - 1] ?? null;
  });
  const summary = $derived(done ? summarize(done, previous, all.current) : null);

  const meal = $derived.by(() => {
    const plan = cal.plan;
    if (!done?.endedAt || toIsoDate(new Date(done.endedAt)) !== todayIso || !plan) return null;
    const now = new Date();
    return nextMeal(plan.payload, isoWeekday(now), today.log, minutesOfDay(now), today.type.request);
  });

  let openIndex = $state<number | null>(null);
  const backHref = historyHref();
  const finishHref = $derived(fromHistory ? historyHref() : '#/');

  async function pickRpe(rpe: number) {
    if (done) await sessionsRepo.update(done.id, { rpe });
  }

  // --- Invia al PT: testo e file pronti prima del tocco (Safari vuole il gesto "fresco") ---
  const shareData = $derived.by(() => {
    if (!done || !summary) return null;
    return { title: `Allenamento · ${done.workoutName}`, text: sessionText(done, summary), file: sessionExportFile(done) };
  });
  let status = $state('');
  let fallbackOpen = $state(false);

  async function share() {
    if (!shareData) return;
    status = '';
    const outcome = await shareSession(shareData);
    if (outcome === 'unsupported') fallbackOpen = true;
    else if (outcome === 'needs-gesture') status = 'Tocca di nuovo «Invia al PT» per aprire la condivisione.';
    else if (outcome !== 'cancelled') status = 'Riepilogo pronto per il PT.';
  }

  async function copyText() {
    if (!shareData) return;
    try {
      await navigator.clipboard.writeText(shareData.text);
      status = 'Testo copiato: incollalo nel messaggio per il PT.';
    } catch {
      status = 'Non riesco a copiare: seleziona il testo qui sopra e copialo a mano.';
    }
  }

  // --- Elimina ---
  let deleteOpen = $state(false);
  async function remove() {
    await deleteSession(id);
    replaceTo(historyHref());
  }
</script>

<div class="screen tone-training" in:slideX|global use:edgeSwipe={() => (location.hash = backHref)}>
  <TopBanner title={session.current?.workoutName ?? 'Riepilogo'} {backHref} backLabel="Torna allo storico">
    {#if done}
      <div class="when mono">
        <span>Riepilogo · {headerDate(new Date(done.startedAt))}</span>
        <span>{timeRange(done.startedAt, done.endedAt)}</span>
      </div>
    {/if}
  </TopBanner>

  <main class="body scroll">
    {#if session.current === undefined}
      <NoteBox title="Sessione non trovata" mark="!" text="Forse è stata eliminata. La trovi, se c'è, nello Storico di Allena." />
      <Button tone="training" href={backHref}>Vai allo Storico</Button>
    {:else if done && summary}
      <section class="stats" aria-label="Numeri della sessione">
        <div class="stat">
          <span class="mono-label">Durata</span>
          <span class="value mono" data-testid="stat-duration">{formatClock(summary.durationSec)}</span>
          <span class="sub">{exercisesLabel(summary.exercises.length)}</span>
        </div>
        <div class="stat">
          <span class="mono-label">Volume</span>
          <span class="value mono" data-testid="stat-volume">{volumeLabel(summary.volume)}</span>
          <span class="sub">kg × ripetizioni</span>
        </div>
        <div class="stat">
          <span class="mono-label">Serie</span>
          <span class="value mono" data-testid="stat-sets">{summary.done}/{summary.planned}</span>
          <span class="sub">{summary.skipped === 0 ? 'tutte fatte' : summary.skipped === 1 ? '1 saltata' : `${summary.skipped} saltate`}</span>
        </div>
        <div class="stat">
          <span class="mono-label">Record</span>
          <span class="value mono record" data-testid="stat-records">{summary.records}</span>
          <span class="sub">{summary.recordNames.join(' · ').toLowerCase() || 'nessuno questa volta'}</span>
        </div>
        <span class="sticker-wrap" aria-hidden="true"><span class="sticker" in:pop|global={{ duration: 500 }}>Fatto!</span></span>
      </section>

      {#if done.readiness && summary.readinessTotal !== null}
        {@const r = done.readiness}
        <section class="card readiness" aria-labelledby="ready-title">
          <div class="card-head">
            <h2 id="ready-title" class="mono-label">Readiness pre-allenamento</h2>
            <span class="mono total">{summary.readinessTotal}<small>/{READINESS_MAX}</small></span>
          </div>
          {#each READINESS_ITEMS as item (item.key)}
            <div class="r-row" role="img" aria-label="{item.label}: {r[item.key]} su 5">
              <span>{item.short}</span>
              <span class="cells" aria-hidden="true">
                {#each [1, 2, 3, 4, 5] as n (n)}<span class="cell" class:on={n <= r[item.key]}></span>{/each}
              </span>
              <span class="mono v" aria-hidden="true">{r[item.key]}</span>
            </div>
          {/each}
        </section>
      {/if}

      <section class="exercises" aria-labelledby="ex-title">
        <h2 id="ex-title" class="ex-title">Esercizi</h2>
        {#each summary.exercises as exercise (exercise.index)}
          {#if exercise.cardio}
            {@const c = exercise.cardio}
            <div class="cardio" data-testid="summary-cardio">
              <span class="cardio-name">Cardio · {exercise.name}</span>
              <span class="mono" class:skipped={!c.done}>
                {c.done ? `${cardioDoneLabel(c.plannedMin, c.minutes, c.distanceKm)} ✓` : `${c.plannedMin}’ · non fatto`}
              </span>
              {#if exercise.note}<p class="cardio-note">Tua nota per il PT: {exercise.note}</p>{/if}
            </div>
          {:else}
            <ExerciseSummary
              {exercise}
              open={openIndex === exercise.index}
              ontoggle={() => (openIndex = openIndex === exercise.index ? null : exercise.index)}
            />
          {/if}
        {/each}
      </section>

      <section class="card" aria-label="Sforzo percepito">
        <RpePicker value={done.rpe} onpick={(rpe) => void pickRpe(rpe)} />
      </section>

      {#if meal}
        <NextMealCard next={meal} />
      {/if}

      <p class="status" role="status">{status}</p>

      <button type="button" class="delete tap" onclick={() => (deleteOpen = true)}>Elimina sessione</button>
    {/if}
  </main>

  {#if done}
    <footer class="foot">
      <Button tone="training" size="lg" onclick={() => void share()}>
        <Icon name="share" size={18} stroke={2.2} /> Invia al PT
      </Button>
      <Button variant="secondary" tone="neutral" href={finishHref}>Fine</Button>
    </footer>
  {/if}
</div>

<ConfirmSheet
  bind:open={deleteOpen}
  title="Eliminare la sessione?"
  text="«{session.current?.workoutName ?? ''}» del {done ? headerDate(new Date(done.startedAt)).toLowerCase() : ''} sparirà dallo storico, dai record e dall’«ultima volta». Non si può annullare."
  actions={[
    { label: 'Elimina', kind: 'danger', run: () => void remove() },
    { label: 'Annulla', kind: 'secondary', run: () => {} },
  ]}
/>

{#if shareData}
  <BottomSheet bind:open={fallbackOpen} title="Invia al PT" tone="training">
    <p class="fb-hint">Questo telefono non apre il foglio di condivisione. Copia il testo o scarica il file e mandali al PT.</p>
    <textarea class="fb-text mono" readonly rows="8" aria-label="Riepilogo in testo" value={shareData.text}></textarea>
    <Button tone="training" block onclick={() => void copyText()}>Copia testo</Button>
    <Button variant="secondary" tone="neutral" block onclick={() => downloadFile(shareData.file)}>Scarica il file</Button>
  </BottomSheet>
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    height: var(--app-h);
    background-image:
      radial-gradient(circle at 90% 8%, var(--tone-tint), transparent 40%),
      radial-gradient(circle at 5% 60%, var(--progress-tint), transparent 35%);
  }

  .when {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    padding-left: 10px;
    font-size: 12px;
    letter-spacing: 1px;
    color: var(--muted);
    white-space: nowrap;
    text-transform: uppercase;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-5) calc(var(--space-5) + var(--safe-right)) var(--space-6) calc(var(--space-5) + var(--safe-left));
  }

  .stats {
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    padding: 14px;
    background: var(--surface);
    clip-path: polygon(
      var(--cut-m) 0,
      100% 0,
      100% calc(100% - var(--cut-m)),
      calc(100% - var(--cut-m)) 100%,
      0 100%,
      0 var(--cut-m)
    );
  }

  .stat .mono-label {
    font-size: 11px;
  }

  .value {
    font-weight: 700;
    font-size: 24px;
    line-height: 1.1;
    white-space: nowrap;
  }

  .value.record {
    color: var(--training);
    text-shadow: 0 0 12px var(--training-glow);
  }

  .sub {
    font-size: 12px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  /* Adesivo "Fatto!": ruotato sul contenitore, il pop scala solo quello interno. */
  .sticker-wrap {
    position: absolute;
    right: -6px;
    top: -14px;
    transform: rotate(-6deg);
    pointer-events: none;
  }

  .sticker {
    display: block;
    padding: var(--space-1) 10px;
    background: var(--food);
    color: var(--on-tone);
    font-family: var(--font-graffiti);
    font-size: 16px;
    box-shadow: 0 0 16px var(--food-glow);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: var(--space-4);
    background: var(--surface);
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .card-head h2 {
    margin: 0;
    font-size: 12px;
  }

  .total {
    font-weight: 700;
    font-size: 16px;
    color: var(--training);
  }

  .total small {
    font-size: 12px;
    color: var(--muted);
  }

  .r-row {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr) 24px;
    gap: 10px;
    align-items: center;
    font-size: 13px;
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 3px;
  }

  .cell {
    height: 8px;
    background: var(--line);
  }

  .cell.on {
    background: var(--training);
  }

  .v {
    text-align: right;
    color: var(--text-2);
  }

  .exercises {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .ex-title {
    margin: 0 0 2px;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 24px;
    color: var(--training);
  }

  .cardio {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) 14px;
    border: 1px dashed var(--line-strong);
    font-size: 14px;
  }

  .cardio .mono {
    color: var(--training);
  }

  .cardio .mono.skipped {
    color: var(--tip);
  }

  .cardio-name {
    min-width: 0;
  }

  .cardio-note {
    flex-basis: 100%;
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
  }

  .status:empty {
    display: none;
  }

  .status {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .delete {
    align-self: center;
    min-height: var(--touch);
    padding: 0 var(--space-4);
    border: 1px solid var(--tip-edge);
    background: transparent;
    color: var(--tip);
    font-weight: 700;
    font-size: 14px;
  }

  .foot {
    flex: none;
    position: relative;
    z-index: var(--z-banner);
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
    padding: 14px calc(var(--space-5) + var(--safe-right)) max(14px, calc(var(--safe-bottom) + 8px))
      calc(var(--space-5) + var(--safe-left));
    background: var(--surface);
    box-shadow: inset 0 1px 0 var(--training-edge);
  }

  .fb-hint {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .fb-text {
    box-sizing: border-box;
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: 0;
    background: var(--bg);
    color: var(--text);
    font-size: 16px;
    line-height: 1.4;
    resize: none;
  }
</style>
