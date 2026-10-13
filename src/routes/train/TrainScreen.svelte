<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import Tabs from '../../lib/components/Tabs.svelte';
  import { ValidationError } from '../../lib/data/errors';
  import { liveState } from '../../lib/data/live.svelte';
  import { listRunLogs, listRuns } from '../../lib/data/repo/runs';
  import { activeSession, recentSessions } from '../../lib/data/repo/sessions';
  import { DEFAULT_WORKOUT_AUTHOR, getWorkoutAuthor, getWorkoutDraft } from '../../lib/data/repo/settings';
  import { deleteWorkout, duplicateWorkoutById, listWorkoutsRecent, restorePreviousVersion } from '../../lib/data/repo/workouts';
  import type { Run, RunLog } from '../../lib/data/schemas/runs';
  import type { Session } from '../../lib/data/schemas/sessions';
  import type { SavedDraft, WorkoutAuthor } from '../../lib/data/schemas/workout-draft';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { headerDate, isoWeekday, shortDate, toIsoDate } from '../../lib/diet/calc/calendar';
  import { routeHref } from '../../lib/routes';
  import { route } from '../../lib/router.svelte';
  import { prepareWorkoutShare, type PreparedShare } from '../../lib/share/prepare';
  import { weekPlan } from '../../lib/workouts/calc/week';
  import { liveCalendar } from '../../lib/calendar/live.svelte';
  import { shortDay } from '../../lib/calendar/move';
  import { calendarWindow } from '../../lib/calendar/occurrences';
  import CalendarActions from '../calendar/CalendarActions.svelte';
  import { originLabel } from '../../lib/workouts/format';
  import { syncLibrary } from '../../lib/workouts/library/sync';
  import Screen from '../Screen.svelte';
  import ConfirmSheet, { type ConfirmAction } from './ConfirmSheet.svelte';
  import { dayStateLabel } from './day-state';
  import HistoryTab from './HistoryTab.svelte';
  import NewChoiceSheet from './NewChoiceSheet.svelte';
  import NextCard from './NextCard.svelte';
  import RunLogSheet from './RunLogSheet.svelte';
  import RunRow from './RunRow.svelte';
  import WeekStrip from './WeekStrip.svelte';
  import WorkoutRow from './WorkoutRow.svelte';
  import ShareSheet from '../share/ShareSheet.svelte';
  import ResumeCard from '../session/ResumeCard.svelte';
  import StartGate from '../session/StartGate.svelte';

  interface Props {
    now: Date;
  }

  let { now }: Props = $props();
  // Fissato alla creazione: a mezzanotte la schermata si ricrea (vedi Train.svelte).
  const today = untrack(() => now);

  onMount(() => {
    void syncLibrary().catch(() => null);
  });

  const workouts = liveState<Workout[]>(listWorkoutsRecent, []);
  const sessions = liveState<Session[]>(() => recentSessions(), []);
  const draft = liveState<SavedDraft | null>(getWorkoutDraft, null);

  const runs = liveState<Run[]>(listRuns, []);
  const runLogs = liveState<RunLog[]>(listRunLogs, []);
  const todayIso = toIsoDate(today);

  // 2c: settimana dalle occorrenze (spostamenti e salti); le stesse azioni di Home e calendario.
  const win = calendarWindow(todayIso);
  const cal = liveCalendar(win.from, win.to);
  const calInput = $derived(cal.input(todayIso));
  const plan = $derived(weekPlan(calInput));
  let actions: CalendarActions;

  /** Ultima corsa fatta di ogni corsa pianificata (le registrazioni sono dalla più recente). */
  const lastRunLog = $derived.by(() => {
    const map = new Map<string, string>();
    for (const log of runLogs.current) if (log.runId && !map.has(log.runId)) map.set(log.runId, log.date);
    return map;
  });

  // --- Corsa (2a): "+ Nuova" → Scheda o Corsa; "Segna come fatta"; menu della corsa ---
  let newOpen = $state(false);
  let logOpen = $state(false);
  let logRun = $state.raw<Run | null>(null);
  let runActionsOpen = $state(false);
  let currentRun = $state.raw<Run | null>(null);

  function openLog(run: Run) {
    runActionsOpen = false;
    logRun = run;
    status = '';
    logOpen = true;
  }

  function openRunActions(run: Run) {
    currentRun = run;
    status = '';
    runActionsOpen = true;
  }
  let selected = $state(isoWeekday(today));
  const selectedDay = $derived(plan.days[selected - 1]);

  /** Ultima sessione conclusa di ogni scheda. */
  const lastRun = $derived.by(() => {
    const map = new Map<string, string>();
    for (const s of sessions.current) if (s.endedAt && !map.has(s.workoutId)) map.set(s.workoutId, s.startedAt);
    return map;
  });

  type TabId = 'schede' | 'storico';
  const TABS: readonly { id: TabId; label: string }[] = [
    { id: 'schede', label: 'Schede' },
    { id: 'storico', label: 'Storico' },
  ];
  // `#/allena?tab=storico` (dal Riepilogo) apre direttamente lo Storico.
  let tab = $state<TabId>(untrack(() => route.query['tab']) === 'storico' ? 'storico' : 'schede');

  // --- Condividi (M8): link, QR, file; tutto preparato prima del tocco ---
  const me = liveState<WorkoutAuthor>(getWorkoutAuthor, DEFAULT_WORKOUT_AUTHOR);
  let shared = $state.raw<PreparedShare | null>(null);
  let shareOpen = $state(false);

  function openShare(w: Workout) {
    actionsOpen = false;
    try {
      shared = prepareWorkoutShare(w, me.current);
      status = '';
      shareOpen = true;
    } catch (error) {
      status = error instanceof ValidationError ? `Non posso condividere «${w.name}»: ${error.errors.join(' ')}` : 'Condivisione non riuscita.';
    }
  }
  // Avvio: una sola sessione in corso per volta (StartGate chiede Riprendi / Abbandona e inizia).
  let gate: StartGate;
  const active = liveState<Session | null>(activeSession, null);

  let current = $state<Workout | null>(null);
  let actionsOpen = $state(false);
  /** Riga con Duplica/Elimina rivelate dallo swipe (una per volta). */
  let swipedRow = $state<string | null>(null);
  let status = $state('');

  // Ritorno dall'editor della corsa (`?corsa=<messaggio>`): conferma come testo.
  const runMessage = untrack(() => route.query['corsa']) ?? '';
  $effect(() => {
    if (runMessage) untrack(() => (status = runMessage));
  });

  // Arrivo da Importa (`?importata=<id>`, M8): conferma con nome e origine.
  const importedId = untrack(() => route.query['importata']) ?? null;
  let importedShown = false;
  $effect(() => {
    if (!importedId || importedShown || !workouts.loaded) return;
    const w = workouts.current.find((x) => x.id === importedId);
    if (!w) return;
    importedShown = true;
    untrack(() => (status = `Scheda «${w.name}» importata (${originLabel(w)}).`));
  });

  let confirmOpen = $state(false);
  let confirm = $state<{ title: string; text: string; actions: ConfirmAction[] }>({ title: '', text: '', actions: [] });

  function openActions(w: Workout) {
    current = w;
    status = '';
    actionsOpen = true;
  }

  function go(hash: string) {
    actionsOpen = false;
    location.hash = hash;
  }

  async function duplicate(w: Workout) {
    actionsOpen = false;
    try {
      const copy = await duplicateWorkoutById(w.id);
      status = `Creata «${copy.name}» (v1, senza giorni assegnati).`;
    } catch (error) {
      status = error instanceof ValidationError ? error.errors.join(' ') : 'Non sono riuscito a duplicare la scheda.';
    }
  }

  function askDelete(w: Workout) {
    actionsOpen = false;
    confirm = {
      title: 'Eliminare la scheda?',
      text: `«${w.name}» verrà eliminata da questo telefono. Non si può annullare.`,
      actions: [
        { label: 'Elimina', kind: 'danger', run: () => void remove(w) },
        { label: 'Annulla', kind: 'secondary', run: () => {} },
      ],
    };
    confirmOpen = true;
  }

  /** "Ripristina versione precedente" (M8): una conferma con le versioni conservate, la più recente prima. */
  function askRestore(w: Workout) {
    actionsOpen = false;
    confirm = {
      title: 'Ripristinare una versione precedente?',
      text: `«${w.name}» ora è alla v${w.version}. La versione attuale non si perde: entra nella cronologia.`,
      actions: [
        ...w.previousVersions.map((p, index): ConfirmAction => ({
          label: `Torna alla v${p.version} (del ${shortDate(new Date(p.updatedAt))})`,
          kind: index === 0 ? 'primary' : 'secondary',
          run: () => void restore(w, index),
        })),
        { label: 'Annulla', kind: 'secondary', run: () => {} },
      ],
    };
    confirmOpen = true;
  }

  async function restore(w: Workout, index: number) {
    try {
      const restored = await restorePreviousVersion(w.id, index);
      status = `«${restored.name}» è tornata alla v${restored.version}.`;
    } catch (error) {
      status = error instanceof ValidationError ? error.errors.join(' ') : 'Ripristino non riuscito.';
    }
  }

  async function remove(w: Workout) {
    try {
      await deleteWorkout(w.id);
      status = `Scheda «${w.name}» eliminata.`;
    } catch {
      status = 'Non sono riuscito a eliminare la scheda.';
    }
  }

  const draftHref = $derived(
    draft.current
      ? routeHref('/allena/editor', {
          id: draft.current.draft.baseVersion === null ? undefined : draft.current.draft.workoutId,
          bozza: '1',
        })
      : '',
  );

  function savedAtLabel(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  }
</script>

<Screen nav="allena">
  <div class="page tone-training">
    <header class="top">
      <span class="date mono-label">{headerDate(today)}</span>
      <div class="title-row">
        <h1 class="graffiti">Allena</h1>
        <a class="import tap" aria-label="Importa una scheda da link, QR o file" href={routeHref('/importa', { da: 'allena' })}>
          <Icon name="qr" size={18} />Importa
        </a>
      </div>
    </header>

    {#if active.current}
      <ResumeCard session={active.current} />
    {/if}

    {#if draft.current}
      <NoteBox title="Bozza non salvata" mark="!">
        <p class="note-text">
          «{draft.current.draft.name || 'Scheda senza nome'}» · {savedAtLabel(draft.current.savedAt)}
        </p>
        <Button tone="tip" variant="secondary" href={draftHref}>Riprendi la bozza</Button>
      </NoteBox>
    {/if}

    <section class="week" aria-label="La tua settimana">
      <WeekStrip days={plan.days} {selected} nextInDays={plan.next?.inDays ?? null} onselect={(d) => (selected = d)} />
      {#if selectedDay}
        <div class="day-detail" data-testid="day-detail">
          <div class="dd-head">
            <span class="dd-text">
              <b>{weekdayName(selectedDay.weekday)}</b>{selectedDay.occurrences.length === 0 ? ' · Riposo' : ''}
            </span>
            <span class="dd-state mono {selectedDay.state}">{dayStateLabel(selectedDay.state, plan.next?.inDays ?? null)}</span>
          </div>
          {#each selectedDay.occurrences as o (o.key)}
            <div class="dd-row" class:skipped={o.skipped}>
              <span class="dd-name">
                {o.kind === 'run' ? `Corsa: ${o.name}` : o.name}{#if o.moved}<span class="dd-moved"
                    >{` · da ${shortDay(o.originalDate)}`}</span
                  >{/if}{#if o.status === 'done'}<span class="dd-moved">{' · fatto ✓'}</span>{/if}
              </span>
              {#if o.status !== 'done' && o.status !== 'in-progress'}
                <button type="button" class="dd-act tap" aria-label="Sposta o salta {o.name}" onclick={() => actions.openMenu(o)}>
                  {o.skipped || o.moved ? 'Modifica' : 'Sposta'}
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      <a class="cal-link tap" href={routeHref('/calendario', { giorno: selectedDay?.date, da: 'allena' })}>Calendario · 3 settimane →</a>
    </section>

    <p class="status" role="status" aria-live="polite">{status}</p>

    <Tabs tabs={TABS} bind:selected={tab} label="Sezioni" tone="training">
      {#snippet panel(id)}
        {#if id === 'schede'}
          <div class="list">
            {#if !workouts.loaded}
              <p class="hint">Carico le schede…</p>
            {:else if workouts.current.length === 0 && runs.current.length === 0}
              <Card tone="training" label="Nessuna scheda">
                <h2 class="empty-title graffiti">Nessuna scheda</h2>
                <p class="empty-text">
                  Crea la tua prima scheda: esercizi dalla libreria, serie, ripetizioni, carichi e giorni della settimana.
                  Resta sul telefono e funziona anche senza rete.
                </p>
                <Button tone="training" size="lg" block href={routeHref('/allena/editor')}>Crea la tua prima scheda</Button>
                <Button tone="progress" variant="secondary" block href={routeHref('/allena/corsa')}>Oppure crea una corsa</Button>
              </Card>
            {:else}
              {#if plan.next}
                <NextCard next={plan.next} onstart={() => plan.next && void gate.request(plan.next.workout, active.loaded ? active.current : undefined)} />
              {/if}
              {#if workouts.current.length > 0}
                <div class="list-head">
                  <h2 class="mono-label">Le tue schede</h2>
                  <span class="mono count">{workouts.current.length}</span>
                </div>
              {/if}
              {#each workouts.current as w (w.id)}
                <WorkoutRow
                  workout={w}
                  lastRun={lastRun.get(w.id) ?? null}
                  open={swipedRow === w.id}
                  onopenchange={(o) => (swipedRow = o ? w.id : swipedRow === w.id ? null : swipedRow)}
                  onopen={() => openActions(w)}
                  onshare={() => openShare(w)}
                  onduplicate={() => void duplicate(w)}
                  ondelete={() => askDelete(w)}
                />
              {/each}
              {#if runs.current.length > 0}
                <div class="list-head runs-head">
                  <h2 class="mono-label">Le tue corse</h2>
                  <span class="mono count">{runs.current.length}</span>
                </div>
                {#each runs.current as r (r.id)}
                  <RunRow run={r} lastDate={lastRunLog.get(r.id) ?? null} onopen={() => openRunActions(r)} onlog={() => openLog(r)} />
                {/each}
              {/if}
              <button type="button" class="new tap" onclick={() => (newOpen = true)}>+ Nuova</button>
            {/if}
          </div>
        {:else}
          <HistoryTab {today} />
        {/if}
      {/snippet}
    </Tabs>
  </div>
</Screen>

{#if current}
  {@const w = current}
  <BottomSheet bind:open={actionsOpen} title={w.name} tone="training">
    <div class="actions">
      <button type="button" class="action tap" onclick={() => go(routeHref('/allena/vedi', { id: w.id }))}>
        <span class="t">Vedi</span><span class="s">come la vede chi si allena</span>
      </button>
      <button type="button" class="action tap" onclick={() => go(routeHref('/allena/editor', { id: w.id }))}>
        <span class="t">Modifica</span><span class="s">esercizi, serie, carichi, giorni</span>
      </button>
      <button type="button" class="action tap" onclick={() => openShare(w)}>
        <span class="t">Condividi</span><span class="s">link, QR o file</span>
      </button>
      {#if w.previousVersions.length > 0}
        <button type="button" class="action tap" onclick={() => askRestore(w)}>
          <span class="t">Ripristina versione precedente</span>
          <span class="s">{w.previousVersions.length === 1 ? '1 versione conservata' : `${w.previousVersions.length} versioni conservate`}</span>
        </button>
      {/if}
      <button type="button" class="action tap" onclick={() => void duplicate(w)}>
        <span class="t">Duplica</span><span class="s">nuova scheda da questa (v1)</span>
      </button>
      <button type="button" class="action tap danger" onclick={() => askDelete(w)}>
        <span class="t">Elimina</span><span class="s">chiede conferma</span>
      </button>
    </div>
  </BottomSheet>
{/if}

{#if currentRun}
  {@const r = currentRun}
  <BottomSheet bind:open={runActionsOpen} title={r.name} tone="progress">
    <div class="actions">
      <button type="button" class="action tap" onclick={() => openLog(r)}>
        <span class="t">Segna come fatta</span><span class="s">durata, distanza, RPE</span>
      </button>
      <button type="button" class="action tap" onclick={() => go(routeHref('/allena/corsa', { id: r.id }))}>
        <span class="t">Modifica</span><span class="s">nome, giorni, orario, obiettivo</span>
      </button>
    </div>
  </BottomSheet>
{/if}

<NewChoiceSheet bind:open={newOpen} />
<RunLogSheet bind:open={logOpen} run={logRun} log={null} date={todayIso} today={todayIso} onsaved={(m) => (status = m)} />

<StartGate bind:this={gate} />
<CalendarActions bind:this={actions} input={calInput} diet={cal.diet} />

<ConfirmSheet bind:open={confirmOpen} title={confirm.title} text={confirm.text} actions={confirm.actions} />

{#if shared}
  <ShareSheet bind:open={shareOpen} share={shared} tone="training" />
{/if}

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: calc(var(--space-6) + var(--safe-top)) calc(var(--space-5) + var(--safe-right)) var(--space-8)
      calc(var(--space-5) + var(--safe-left));
    background-image: radial-gradient(circle at 88% 4%, var(--tone-tint), transparent 38%);
  }

  .top {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .date {
    font-size: 12px;
    white-space: nowrap;
  }

  .title-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h1 {
    font-size: 54px;
    line-height: 1;
    color: var(--tone);
    text-shadow: 0 0 18px var(--tone-glow);
    transform: rotate(-3deg);
    transform-origin: left bottom;
  }

  .import {
    min-height: var(--touch);
    text-decoration: none;
    margin-bottom: var(--space-1);
    padding: 0 var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
  }

  .note-text {
    margin: 0;
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .week {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .day-detail {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    background: var(--surface);
    font-size: 13px;
  }

  .dd-head,
  .dd-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .dd-name {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .dd-row.skipped .dd-name {
    text-decoration: line-through;
    color: var(--muted);
  }

  .dd-moved {
    color: var(--muted);
  }

  .dd-act {
    flex: none;
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
  }

  .cal-link {
    align-self: flex-end;
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    color: var(--progress);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
  }

  .dd-text {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .dd-state {
    flex-shrink: 0;
    font-size: 11px;
    letter-spacing: 1px;
    color: var(--muted);
  }

  .dd-state.done,
  .dd-state.next {
    color: var(--tone);
  }

  .status:empty {
    display: none;
  }

  .status {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .hint {
    color: var(--muted);
  }

  .list-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .list-head h2 {
    margin: 0;
    font-size: 12px;
  }

  .runs-head h2 {
    color: var(--progress);
  }

  .count {
    font-size: 12px;
    color: var(--muted);
  }

  .new {
    display: grid;
    place-items: center;
    min-height: 52px;
    background: transparent;
    border: 1px dashed var(--tone);
    color: var(--tone);
    font-weight: 700;
    font-size: 15px;
    text-decoration: none;
  }

  .empty-title {
    font-size: 30px;
    color: var(--tone);
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-2);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-height: 56px;
    padding: 10px 14px;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    text-align: left;
  }

  .action .t {
    font-weight: 700;
    font-size: 15px;
  }

  .action .s {
    font-size: 12px;
    color: var(--muted);
  }

  .action.danger {
    border-color: var(--tip-edge);
  }

  .action.danger .t {
    color: var(--tip);
  }
</style>
