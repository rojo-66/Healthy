<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import BottomBanner from '../../lib/components/BottomBanner.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import TopBanner from '../../lib/components/TopBanner.svelte';
  import { MAX_TEXT } from '../../lib/data/limits';
  import { deleteSession, lastCompletedForWorkout, saveSession, sessionsRepo } from '../../lib/data/repo/sessions';
  import type { Session } from '../../lib/data/schemas/sessions';
  import { swipe } from '../../lib/design/swipe-action';
  import { prefersReducedMotion, slideX } from '../../lib/design/transitions';
  import { beeper } from '../../lib/sessions/audio';
  import {
    addSet,
    allDone,
    canAddSet,
    currentItem,
    finish,
    goToItem,
    noteFor,
    setRest,
    setRpe,
    setUserNote,
    toggleAll,
    toggleSet,
    updateSet,
  } from '../../lib/sessions/edit';
  import {
    cardioCounts,
    cardioEntry,
    lastCardioTable,
    pauseCardioClock,
    setCardioValues,
    startCardioClock,
    toggleCardioDone,
  } from '../../lib/sessions/cardio';
  import { schemeLabel } from '../../lib/sessions/format';
  import { crossedTarget } from '../../lib/sessions/stopwatch';
  import { sessionItems } from '../../lib/sessions/items';
  import { lastTimeTable } from '../../lib/sessions/last-time';
  import { replaceTo, summaryHref } from '../../lib/sessions/nav';
  import { adjustRest, isFinished, isPaused, pauseRest, resumeRest, skipRest, startRest } from '../../lib/sessions/rest-timer';
  import { durationSec, isExtra, missingSets, segmentsFor, setsOf } from '../../lib/sessions/stats';
  import { keepAwake } from '../../lib/sessions/wake-lock';
  import { createSessionWriter } from '../../lib/sessions/writer';
  import { keepFocusedVisible, keyboardState } from '../../lib/workouts/keyboard.svelte';
  import ConfirmSheet, { type ConfirmAction } from '../train/ConfirmSheet.svelte';
  import CardioBlock from './CardioBlock.svelte';
  import FinishSheet from './FinishSheet.svelte';
  import RestButton from './RestButton.svelte';
  import RestSheet from './RestSheet.svelte';
  import SetRow from './SetRow.svelte';

  // Sessione live (SPEC § 5.4 punto 3): un esercizio per volta, banner fissi, scorre solo il corpo.
  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  const reduce = prefersReducedMotion();
  const keyboard = keyboardState();
  // Ogni modifica va subito nel database: iOS può chiudere l'app in qualsiasi momento.
  const writer = createSessionWriter(saveSession);

  let session = $state.raw<Session | null>(null);
  let previous = $state.raw<Session | undefined>(undefined);
  let missing = $state(false);
  let now = $state(Date.now());
  let scroller = $state<HTMLElement>();
  /** Esercizio che segue il dito durante lo swipe (il contenitore che ascolta resta fermo). */
  let swipeTarget = $state<HTMLDivElement>();
  /** Direzione dell'ultimo cambio di esercizio (1 = SUCC, -1 = PREC): entra da quel lato. */
  let dir = $state(1);
  let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
  let error = $state('');

  // --- Caricamento ---
  onMount(() => {
    void load();
    const tick = setInterval(() => (now = Date.now()), 250);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        resumedAt = Date.now();
        now = resumedAt;
      } else void writer.flush();
    };
    const onPageHide = () => void writer.flush();
    const onOnline = () => (online = navigator.onLine);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  });

  onDestroy(() => {
    void writer.flush();
    keepAwake().stop();
  });

  async function load() {
    const s = await sessionsRepo.get(id);
    if (!s || s.endedAt !== null) {
      // Sessione conclusa o eliminata: non è più "live".
      if (s) return replaceTo(summaryHref(s.id));
      missing = true;
      return;
    }
    previous = await lastCompletedForWorkout(s.workoutId, s.startedAt);
    // Recupero già finito alla riapertura: "PRONTO", senza suono né animazione.
    const rest = s.live?.rest ?? null;
    if (rest && isFinished(rest, Date.now())) notifiedEnd = rest.endsAt;
    session = s;
    void keepAwake().start();
  }

  /** Dopo "Riprendi" l'audio e lo schermo acceso si sbloccano al primo tocco. */
  function firstTouch() {
    if (!beeper.unlocked) beeper.unlock();
    if (!keepAwake().active) void keepAwake().start();
  }

  function commit(next: Session, typing = false) {
    session = next;
    if (typing) writer.saveLater(next);
    else void writer.save(next);
  }

  // --- Dati derivati ---
  const items = $derived(session ? sessionItems(session) : []);
  const index = $derived(session ? currentItem(session) : 0);
  const item = $derived(items[index]);
  const sets = $derived(session ? setsOf(session, index) : []);
  const last = $derived(lastTimeTable(items, previous));
  const lastCardio = $derived(lastCardioTable(items, previous));
  const rest = $derived(session?.live?.rest ?? null);
  const isLast = $derived(index === items.length - 1);
  const everyDone = $derived(session ? allDone(session, index) : false);

  // --- Serie ---
  function withRest(next: Session, start: boolean): Session {
    return start && item?.kind === 'strength' ? setRest(next, startRest(item.restSec, Date.now())) : next;
  }

  function toggle(setIndex: number) {
    if (!session) return;
    const r = toggleSet(session, index, setIndex);
    commit(withRest(r.session, r.startRest));
  }

  function toggleEvery() {
    if (!session) return;
    const r = toggleAll(session, index);
    commit(withRest(r.session, r.startRest));
  }

  // --- Recupero ---
  let restOpen = $state(false);
  let notifiedEnd: string | null = null;
  let resumedAt = Date.now();
  let pulse = $state(false);
  let announce = $state('');
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;

  function changeRest(next: ReturnType<typeof startRest> | null) {
    if (!session) return;
    announce = '';
    commit(setRest(session, next));
  }

  // Fine del recupero: suono breve (se l'audio è sbloccato e non in silenzioso) + impulso + annuncio.
  $effect(() => {
    const r = rest;
    if (!r || r.endsAt === null || !isFinished(r, now) || r.endsAt === notifiedEnd) return;
    notifiedEnd = r.endsAt;
    announce = 'Recupero finito';
    if (document.visibilityState !== 'visible') return;
    // Finito mentre l'app era in background: al ritorno solo "PRONTO", nessun suono in ritardo.
    if (Date.parse(r.endsAt) >= resumedAt - 1500) beeper.beep();
    clearTimeout(pulseTimer);
    pulse = true;
    pulseTimer = setTimeout(() => (pulse = false), 1200);
  });

  // --- Cardio (2a): cronometro e avviso al tempo previsto ---
  let cardioAlert = $state(false);
  let cardioAlertTimer: ReturnType<typeof setTimeout> | undefined;
  let lastTick = Date.now();

  $effect(() => {
    const t = now;
    const prev = lastTick;
    lastTick = t;
    if (!session || item?.kind !== 'cardio') return;
    const entry = cardioEntry(session, index);
    if (!entry || !crossedTarget(entry.clock, item.minutes, prev, t)) return;
    // Arrivato al tempo previsto con la pagina visibile: suono breve + impulso + annuncio (il cronometro continua).
    announce = 'Tempo previsto raggiunto';
    if (document.visibilityState !== 'visible') return;
    beeper.beep();
    clearTimeout(cardioAlertTimer);
    cardioAlert = true;
    cardioAlertTimer = setTimeout(() => (cardioAlert = false), 1200);
  });

  // --- Esercizi ---
  /** Cambio fatto con lo swipe: entra già con il movimento dello swipe, senza la sua transizione. */
  let viaSwipe = $state(false);

  function go(delta: number, swiped = false) {
    if (!session) return;
    dir = delta > 0 ? 1 : -1;
    viaSwipe = swiped;
    commit(goToItem(session, index + delta));
    scroller?.scrollTo({ top: 0 });
  }

  // --- Uscita ---
  let exitOpen = $state(false);
  let abandonOpen = $state(false);
  const exitActions: ConfirmAction[] = [
    { label: 'Esci, la riprendo dopo', kind: 'primary', run: () => void leave() },
    { label: 'Abbandona allenamento', kind: 'danger', run: () => (abandonOpen = true) },
    { label: 'Continua', kind: 'secondary', run: () => {} },
  ];
  const abandonActions: ConfirmAction[] = [
    { label: 'Abbandona', kind: 'danger', run: () => void abandon() },
    { label: 'Continua l’allenamento', kind: 'secondary', run: () => {} },
  ];

  async function leave() {
    await writer.flush();
    replaceTo('#/allena');
  }

  async function abandon() {
    await writer.flush();
    await deleteSession(id);
    replaceTo('#/allena');
  }

  // --- Fine ---
  let finishOpen = $state(false);
  let finishing = $state(false);

  function openFinish() {
    finishOpen = true;
  }

  async function conclude() {
    if (!session) return;
    finishing = true;
    error = '';
    const before = session;
    const ended = finish(session, new Date());
    session = ended;
    await writer.save(ended);
    if (writer.error) {
      session = before;
      error = 'Non sono riuscito a salvare la fine dell’allenamento. Riprova.';
      finishing = false;
      return;
    }
    keepAwake().stop();
    finishOpen = false;
    replaceTo(summaryHref(id));
  }
</script>

<div class="screen tone-training" onpointerdowncapture={firstTouch}>
  <TopBanner
    title={session?.workoutName ?? 'Allenamento'}
    onback={() => (exitOpen = true)}
    backLabel="Torna alla scheda"
    elapsed={session ? durationSec(session, now) : null}
    segments={session ? segmentsFor(session) : undefined}
    current={index}
    progressLabel="Esercizio {index + 1} di {items.length}"
  />

  <main class="body scroll" bind:this={scroller} onfocusin={(e) => keepFocusedVisible(e, reduce)}>
    {#if missing}
      <NoteBox title="Allenamento non trovato" mark="!" text="Forse è stato abbandonato. Torna ad Allena per iniziarne uno." />
      <Button tone="training" href="#/allena">Torna ad Allena</Button>
    {:else if session && item}
      {@const s = session}
      {@const it = item}
      <!--
        Swipe tra gli esercizi (← successivo, → precedente): non parte mentre scrivi nei campi kg/rip né dal bordo sinistro.
        Sull'ultimo esercizio ← non fa niente (resta "Termina allenamento"); sul primo → non fa niente.
      -->
      <div
        class="ex-swipe"
        role="group"
        aria-label="Esercizio: scorri a destra o a sinistra per cambiarlo"
        data-testid="exercise-swipe"
        use:swipe={{ canGo: (d) => items[index + d] !== undefined, onswipe: (d) => go(d, true), target: swipeTarget }}
      >
        <div bind:this={swipeTarget}>
          {#key index}
            <div class="exercise" in:slideX={{ dir, duration: viaSwipe ? 0 : 300 }}>
              <Card tone="training" label="Esercizio in corso">
                <div class="ex-head">
                  <span class="mono-label kicker">Esercizio {index + 1} / {items.length}</span>
                  <span class="mono scheme">{it.kind === 'strength' ? schemeLabel(it) : 'cardio'}</span>
                </div>
                <h2 class="ex-name">{it.name}</h2>
                <div class="ex-meta">
                  <div class="muscles">
                    {#if it.kind === 'strength'}
                      {#each it.muscles as m (m)}<span>{m}</span>{/each}
                    {/if}
                  </div>
                  {#if it.videoUrl}
                    {#if online}
                      <a
                        class="video tap"
                        href={it.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Video di {it.name} (si apre fuori dall'app)"
                      >
                        <Icon name="play" size={14} />Video
                      </a>
                    {:else}
                      <span class="video-off">Video: serve la rete</span>
                    {/if}
                  {/if}
                </div>
    
                {#if it.note}
                  <NoteBox title="Nota del PT" text={it.note} />
                {/if}
    
                {#if it.kind === 'cardio'}
                  <CardioBlock
                    item={it}
                    entry={cardioEntry(s, index)}
                    last={lastCardio[index] ?? null}
                    {now}
                    alerting={cardioAlert}
                    onstart={() => session && commit(startCardioClock(session, index, Date.now()))}
                    onpause={() => session && commit(pauseCardioClock(session, index, Date.now()))}
                    ontoggle={() => session && commit(toggleCardioDone(session, index, Date.now()))}
                    onminutes={(minutes) => session && commit(setCardioValues(session, index, { minutes }), true)}
                    onkm={(distanceKm) => session && commit(setCardioValues(session, index, { distanceKm }), true)}
                  />
                {:else}
                <div class="table" role="table" aria-label="Serie di {it.name}">
                  <div class="thead mono" role="row">
                    <span role="columnheader">SET</span>
                    <span role="columnheader">ULTIMA VOLTA</span>
                    <span role="columnheader" class="c">KG</span>
                    <span role="columnheader" class="c">RIP</span>
                    <span role="columnheader" class="c">
                      <button
                        type="button"
                        class="all tap"
                        class:on={everyDone}
                        aria-pressed={everyDone}
                        aria-label={everyDone ? 'Togli tutte le spunte' : 'Spunta tutte le serie'}
                        onclick={toggleEvery}
                      >
                        <span class="all-fill" aria-hidden="true"></span>
                        <Icon name="doubleCheck" size={20} stroke={2.6} />
                      </button>
                    </span>
                  </div>
                  {#each sets as set (set.setIndex)}
                    <SetRow
                      {set}
                      last={last[index]?.[set.setIndex]}
                      extra={isExtra(s, set)}
                      onkg={(kg) => session && commit(updateSet(session, index, set.setIndex, { kg }), true)}
                      onreps={(reps) => session && commit(updateSet(session, index, set.setIndex, { reps }), true)}
                      ontoggle={() => toggle(set.setIndex)}
                    />
                  {/each}
                </div>
                <button
                  type="button"
                  class="add tap"
                  disabled={!canAddSet(s, index)}
                  onclick={() => session && commit(addSet(session, index))}>+ Aggiungi serie</button
                >
                {/if}
              </Card>
    
              <section class="notes">
                <label class="mono-label" for="note-pt">Le tue note per il PT</label>
                <textarea
                  id="note-pt"
                  rows="4"
                  maxlength={MAX_TEXT.note}
                  placeholder="Cosa noti, cosa ti viene male, fastidi, sensazioni…"
                  value={noteFor(s, index)}
                  oninput={(e) => session && commit(setUserNote(session, index, e.currentTarget.value), true)}
                ></textarea>
                <span class="hint">Finiscono nel riepilogo che condividi con il PT.</span>
              </section>
    
              {#if isLast}
                <div class="end">
                  <Button tone="training" size="lg" block onclick={openFinish}>Termina allenamento</Button>
                  <span class="hint">Crea il riepilogo della sessione</span>
                </div>
              {/if}
              {#if error}<p class="error" role="alert">{error}</p>{/if}
            </div>
          {/key}
        </div>
      </div>
    {/if}
  </main>

  <div class="foot" class:hidden={keyboard.open} inert={keyboard.open}>
    <BottomBanner
      prevLabel="Esercizio precedente"
      nextLabel="Esercizio successivo"
      prevDisabled={!session || index === 0}
      nextDisabled={!session || isLast}
      onprev={() => go(-1)}
      onnext={() => go(1)}
    >
      {#snippet center()}
        <RestButton {rest} {now} {pulse} onopen={() => (restOpen = true)} />
      {/snippet}
    </BottomBanner>
  </div>

  <p class="visually-hidden" aria-live="polite" data-testid="rest-announce">{announce}</p>
</div>

<RestSheet
  bind:open={restOpen}
  {rest}
  {now}
  defaultSec={item?.kind === 'strength' ? item.restSec : 90}
  onstart={(sec) => changeRest(startRest(sec, Date.now()))}
  onadjust={(delta) => changeRest(adjustRest(rest, delta, Date.now()))}
  ontogglepause={() => changeRest(isPaused(rest) ? resumeRest(rest, Date.now()) : pauseRest(rest, Date.now()))}
  onskip={() => changeRest(skipRest())}
/>

{#if session}
  <FinishSheet
    bind:open={finishOpen}
    missing={missingSets(session)}
    cardioMissing={cardioCounts(session).total - cardioCounts(session).done}
    rpe={session.rpe}
    busy={finishing}
    onrpe={(rpe) => session && commit(setRpe(session, rpe))}
    onfinish={() => void conclude()}
  />
{/if}

<ConfirmSheet
  bind:open={exitOpen}
  title="Uscire dall’allenamento?"
  text="La sessione resta in corso: la riprendi da Allena quando vuoi."
  actions={exitActions}
/>
<ConfirmSheet
  bind:open={abandonOpen}
  title="Abbandonare l’allenamento?"
  text="Le serie segnate finora verranno cancellate e la sessione non finirà nello storico. Non si può annullare."
  actions={abandonActions}
/>

<style>
  .screen {
    position: relative;
    display: flex;
    flex-direction: column;
    height: var(--app-h);
    overflow: hidden;
    background-image: radial-gradient(circle at 90% 8%, var(--tone-tint), transparent 40%);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    padding: var(--space-4) calc(var(--space-5) + var(--safe-right)) calc(150px + var(--safe-bottom))
      calc(var(--space-5) + var(--safe-left));
  }

  .exercise {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .ex-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .kicker {
    font-size: 12px;
    color: var(--training);
  }

  .scheme {
    font-size: 12px;
    color: var(--muted);
    text-align: right;
  }

  .ex-name {
    margin: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 28px;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .ex-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .muscles {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .muscles span {
    padding: var(--space-1) 10px;
    border: 1px solid var(--line-strong);
    font-size: 12px;
    color: var(--text-2);
  }

  .video {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch);
    padding: 0 14px;
    border: 1px solid var(--progress);
    color: var(--progress);
    font-weight: 700;
    font-size: 13px;
    text-decoration: none;
  }

  .video-off {
    flex: none;
    font-size: 12px;
    color: var(--muted);
  }

  .table {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .thead {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 70px 54px 44px;
    gap: var(--space-2);
    align-items: center;
    padding: 0 var(--space-1);
    font-size: 11px;
    letter-spacing: 0.5px;
    white-space: nowrap;
    color: var(--muted);
  }

  .c {
    text-align: center;
  }

  .all {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--training);
    background: transparent;
    color: var(--training);
  }

  .all-fill {
    position: absolute;
    inset: 0;
    background: var(--training);
    transform: scale(0);
    opacity: 0;
    transition:
      transform var(--dur-ind) var(--spring),
      opacity var(--dur-press) ease;
  }

  .all.on {
    color: var(--on-tone);
  }

  .all.on .all-fill {
    transform: scale(1);
    opacity: 1;
  }

  .all :global(svg) {
    position: relative;
  }

  .add {
    min-height: var(--touch);
    border: 1px dashed var(--line-strong);
    background: transparent;
    color: var(--muted);
    font-size: 14px;
  }

  .add:disabled {
    opacity: 0.4;
  }

  .notes {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .notes label {
    font-size: 12px;
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: var(--space-3) 14px;
    border: 1px solid var(--line);
    border-radius: 0;
    background: var(--surface);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.45;
    resize: none;
  }

  textarea:focus {
    outline: 2px solid var(--training);
    outline-offset: -1px;
  }

  .hint {
    font-size: 12px;
    color: var(--muted);
  }

  .end {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: center;
  }

  .error {
    margin: 0;
    color: var(--tip);
    font-size: 14px;
  }

  /* Banner inferiore fisso sopra il corpo; con la tastiera aperta scivola via (solo transform/opacity). */
  .foot {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-banner);
    pointer-events: none;
    transition:
      transform var(--dur-sheet) var(--ease-out),
      opacity var(--dur-fade) ease;
  }

  .foot.hidden {
    transform: translateY(100%);
    opacity: 0;
  }
</style>
