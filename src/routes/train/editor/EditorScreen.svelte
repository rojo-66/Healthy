<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import BottomSheet from '../../../lib/components/BottomSheet.svelte';
  import Button from '../../../lib/components/Button.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import NoteBox from '../../../lib/components/NoteBox.svelte';
  import { prefersReducedMotion } from '../../../lib/design/transitions';
  import { ValidationError } from '../../../lib/data/errors';
  import { MAX_ITEMS } from '../../../lib/data/limits';
  import { liveState } from '../../../lib/data/live.svelte';
  import { listExercisesByName } from '../../../lib/data/repo/exercises';
  import { clearWorkoutDraft, getWorkoutAuthor, saveWorkoutDraft } from '../../../lib/data/repo/settings';
  import { saveWorkout, type SavedWorkout } from '../../../lib/data/repo/workouts';
  import { weekdayName } from '../../../lib/data/schemas/diet-payload';
  import type { Exercise } from '../../../lib/data/schemas/exercises';
  import type { DraftItem, WorkoutAuthor, WorkoutDraft } from '../../../lib/data/schemas/workout-draft';
  import type { Workout } from '../../../lib/data/schemas/workouts';
  import { WEEKDAY_INITIALS } from '../../../lib/diet/calc/calendar';
  import { replaceRoute } from '../../../lib/router.svelte';
  import { routeHref } from '../../../lib/routes';
  import { debounced } from '../../../lib/workouts/debounce';
  import { workoutTotals } from '../../../lib/workouts/calc/duration';
  import { firstItemWithError, itemErrors, validateDraft } from '../../../lib/workouts/calc/editor-schema';
  import { disablePyramid, pyramidDiffers } from '../../../lib/workouts/calc/sets-detail';
  import { saveKind, versionAfterSave } from '../../../lib/workouts/calc/version';
  import { drop } from '../../../lib/design/transitions';
  import { longPressDrag } from '../../../lib/workouts/drag-reorder';
  import {
    draftFingerprint,
    draftFromWorkout,
    duplicateItem,
    itemFromExercise,
    moveItem,
    removeItem,
  } from '../../../lib/workouts/draft';
  import { flipRows } from '../../../lib/workouts/flip';
  import { kgLabel, parseTimeInput } from '../../../lib/workouts/format';
  import { keepFocusedVisible, keyboardState } from '../../../lib/workouts/keyboard.svelte';
  import ActionBar from '../ActionBar.svelte';
  import ConfirmSheet, { type ConfirmAction } from '../ConfirmSheet.svelte';
  import WorkoutPreview, { type PreviewWorkout } from '../WorkoutPreview.svelte';
  import CardioField from './CardioField.svelte';
  import EditorHeader from './EditorHeader.svelte';
  import ExerciseRow from './ExerciseRow.svelte';
  import LibrarySheet from './LibrarySheet.svelte';
  import WarmupSheet from './WarmupSheet.svelte';

  interface Props {
    initial: WorkoutDraft;
    /** Impronta della scheda di partenza: diversa da quella della bozza = modifiche non salvate. */
    baseline: string;
    original: Workout | undefined;
    author: WorkoutAuthor;
    /** La bozza è stata ripresa (esiste già nel database). */
    resumed: boolean;
  }

  let { initial, baseline: baselineProp, original: originalProp, author: authorProp, resumed }: Props = $props();

  // Stato immutabile: ogni modifica crea una bozza nuova (funzioni pure di lib/workouts/draft.ts).
  let draft = $state.raw<WorkoutDraft>(untrack(() => initial));
  let baseline = $state(untrack(() => baselineProp));
  let original = $state.raw<Workout | undefined>(untrack(() => originalProp));
  let author = $state.raw<WorkoutAuthor>(untrack(() => authorProp));

  const reduce = prefersReducedMotion();
  const keyboard = keyboardState();
  const exercises = liveState<Exercise[]>(listExercisesByName, []);

  const dirty = $derived(draftFingerprint(draft) !== baseline);
  const totals = $derived(workoutTotals(draft));
  const kind = $derived(saveKind(original, author));
  const badge = $derived(
    kind === 'new' ? 'NUOVA · v1' : kind === 'copy' ? 'COPIA · v1' : `v${original!.version} → v${versionAfterSave(original, author)}`,
  );
  const present = $derived(new Set(draft.items.map((i) => i.exerciseId).filter((id): id is string => id !== null)));

  // --- Errori: dopo il primo tentativo di salvataggio, ricalcolati a ogni modifica ---
  let attempted = $state(false);
  const validation = $derived(attempted ? validateDraft(draft) : null);
  const fields = $derived(validation && !validation.ok ? validation.fields : {});
  const errorCount = $derived(validation && !validation.ok ? validation.count : 0);
  const warmupHasErrors = $derived(Object.keys(fields).some((k) => k.startsWith('warmup.')));

  // --- Bozza automatica: 400 ms dopo ogni modifica, subito se l'app va in background ---
  const autosave = debounced(400);
  let ownsDraft = untrack(() => resumed);

  $effect(() => {
    const d = draft;
    const isDirty = dirty;
    untrack(() => {
      if (isDirty) {
        autosave.schedule(() => {
          ownsDraft = true;
          void saveWorkoutDraft(d).catch(() => null);
        });
      } else if (ownsDraft) {
        autosave.schedule(() => {
          ownsDraft = false;
          void clearWorkoutDraft().catch(() => null);
        });
      }
    });
  });

  onMount(() => {
    const flush = () => autosave.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  });

  // --- Modifiche ---
  function set(patch: Partial<WorkoutDraft>) {
    draft = { ...draft, ...patch };
  }

  function setItem(index: number, next: DraftItem) {
    draft = { ...draft, items: draft.items.map((item, i) => (i === index ? next : item)) };
  }

  function toggleDay(day: number) {
    set({ weekdays: draft.weekdays.includes(day) ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day] });
  }

  let scroller: HTMLElement | undefined = $state();
  let listEl: HTMLElement | undefined = $state();
  let openKey = $state<string | null>(null);
  let announcement = $state('');

  function announce(text: string) {
    announcement = '';
    void tick().then(() => (announcement = text));
  }

  function moveRow(index: number, dir: -1 | 1) {
    const to = index + dir;
    const name = draft.items[index]?.name ?? '';
    void flipRows(listEl, () => (draft = moveItem(draft, index, to)), reduce).then(() =>
      announce(`${name} spostato in posizione ${to + 1} di ${draft.items.length}`),
    );
  }

  function dragRow(event: PointerEvent, index: number) {
    if (!listEl || !scroller) return;
    longPressDrag(event, {
      list: listEl,
      scroller,
      index,
      reduceMotion: reduce,
      onstart: () => (openKey = null),
      ondrop: (from, to) => {
        if (from === to) return;
        const name = draft.items[from]?.name ?? '';
        draft = moveItem(draft, from, to);
        announce(`${name} spostato in posizione ${to + 1} di ${draft.items.length}`);
      },
    });
  }

  function duplicateRow(index: number) {
    void flipRows(
      listEl,
      () => {
        draft = duplicateItem(draft, index);
        openKey = draft.items[index + 1]?.key ?? null;
      },
      reduce,
    );
  }

  // Elimina con "Annulla" per qualche secondo.
  let undo = $state<{ item: DraftItem; index: number } | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  function removeRow(index: number) {
    const item = draft.items[index];
    if (!item) return;
    void flipRows(
      listEl,
      () => {
        draft = removeItem(draft, index);
        if (openKey === item.key) openKey = null;
      },
      reduce,
    );
    undo = { item, index };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undo = null), 8000);
  }

  function undoRemove() {
    const u = undo;
    if (!u) return;
    const items = draft.items.slice();
    items.splice(Math.min(u.index, items.length), 0, u.item);
    void flipRows(listEl, () => (draft = { ...draft, items }), reduce);
    undo = null;
    clearTimeout(undoTimer);
  }

  // --- Libreria ---
  let libraryOpen = $state(false);
  const canAdd = $derived(draft.items.length < MAX_ITEMS.workoutItems);

  async function addExercise(ex: Exercise) {
    libraryOpen = false;
    const item = itemFromExercise(ex);
    draft = { ...draft, items: [...draft.items, item] };
    openKey = item.key;
    await tick();
    listEl
      ?.querySelector(`[data-key="${item.key}"]`)
      ?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    announce(`${ex.name} aggiunto alla scheda`);
  }

  // --- Conferme ---
  let confirmOpen = $state(false);
  let confirm = $state.raw<{ title: string; text: string; actions: ConfirmAction[] }>({ title: '', text: '', actions: [] });

  function ask(title: string, text: string, actions: ConfirmAction[]) {
    confirm = { title, text, actions };
    confirmOpen = true;
  }

  function pyramidOff(index: number) {
    const item = draft.items[index];
    if (!item?.setsDetail) return;
    if (!pyramidDiffers(item)) return setItem(index, disablePyramid(item));
    const first = item.setsDetail[0]!;
    const key = item.key;
    ask(
      'Serie tutte uguali?',
      `Le ${item.sets} serie diventano ${item.sets} × ${first.reps} · ${kgLabel(first.kg)} kg. Riattivando «Serie diverse» ritrovi i valori di adesso.`,
      [
        {
          label: 'Rendi uniformi',
          kind: 'primary',
          run: () => {
            const i = draft.items.findIndex((x) => x.key === key);
            const current = draft.items[i];
            if (current) setItem(i, disablePyramid(current));
          },
        },
        { label: 'Annulla', kind: 'secondary', run: () => {} },
      ],
    );
  }

  // --- Uscita ---
  function leave() {
    location.hash = '#/allena';
  }

  async function discardAndLeave() {
    autosave.cancel();
    ownsDraft = false;
    baseline = draftFingerprint(draft);
    await clearWorkoutDraft().catch(() => null);
    leave();
  }

  function back() {
    if (!dirty) return leave();
    ask('Modifiche non salvate', `Hai modifiche non salvate a «${draft.name || 'scheda senza nome'}».`, [
      { label: 'Salva', kind: 'primary', run: () => void save() },
      { label: 'Esci senza salvare', kind: 'danger', run: () => void discardAndLeave() },
      { label: 'Continua a modificare', kind: 'secondary', run: () => {} },
    ]);
  }

  // --- Salvataggio ---
  let busy = $state(false);
  let saveError = $state('');

  async function revealFirstError(fieldsNow: Readonly<Record<string, string>>) {
    const index = firstItemWithError(fieldsNow);
    if (index !== null) openKey = draft.items[index]?.key ?? null;
    await tick();
    scroller
      ?.querySelector('[data-error], [aria-invalid="true"]')
      ?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }

  /** Righe con le chiavi di prima: l'editor resta com'era (righe aperte, animazioni). */
  function rebase(fresh: WorkoutDraft, old: WorkoutDraft): WorkoutDraft {
    return {
      ...fresh,
      items: fresh.items.map((it, i) => ({ ...it, key: old.items[i]?.key ?? it.key, setsDetailMemory: old.items[i]?.setsDetailMemory ?? null })),
      warmup: fresh.warmup.map((w, i) => ({ ...w, key: old.warmup[i]?.key ?? w.key })),
    };
  }

  function savedText(result: SavedWorkout): string {
    const w = result.workout;
    if (result.kind === 'copy') return `Hai creato la tua copia «${w.name}» (v1). La scheda del PT resta com'era.`;
    if (result.kind === 'update') return `«${w.name}» salvata · v${result.from} → v${w.version}.`;
    return `«${w.name}» salvata · v${w.version}.`;
  }

  const SHARE_SOON = 'L’invio al cliente (link, QR, file) arriva con la condivisione, nel prossimo aggiornamento.';

  // Foglio separato da quello delle conferme: "Salva" dall'uscita lo apre mentre l'altro si sta chiudendo.
  let savedOpen = $state(false);
  let savedMessage = $state('');
  const SAVED_ACTIONS: ConfirmAction[] = [
    { label: 'Torna alle schede', kind: 'primary', run: () => leave() },
    { label: 'Continua a modificare', kind: 'secondary', run: () => {} },
  ];

  function showSaved(text: string) {
    savedMessage = `${text} ${SHARE_SOON}`;
    savedOpen = true;
  }

  async function save() {
    if (busy) return;
    saveError = '';
    attempted = true;
    const check = validateDraft(draft);
    if (!check.ok) return revealFirstError(check.fields);
    if (!dirty && original && kind === 'update') {
      return showSaved(`Nessuna modifica: «${original.name}» resta alla v${original.version}.`);
    }
    busy = true;
    try {
      autosave.cancel();
      const result = await saveWorkout(draft);
      ownsDraft = false;
      author = await getWorkoutAuthor();
      original = result.workout;
      draft = rebase(draftFromWorkout(result.workout), draft);
      baseline = draftFingerprint(draft);
      attempted = false;
      // Scheda nuova o copia: da ora si modifica quella salvata (id nell'indirizzo, senza ricaricare).
      if (result.kind !== 'update') replaceRoute(routeHref('/allena/editor', { id: result.workout.id }));
      showSaved(savedText(result));
    } catch (error) {
      saveError =
        error instanceof ValidationError ? error.errors.join(' ') : 'Salvataggio non riuscito: la bozza resta sul telefono.';
    } finally {
      busy = false;
    }
  }

  // --- Anteprima e riscaldamento ---
  let previewOpen = $state(false);
  let warmupOpen = $state(false);
  const preview = $derived<PreviewWorkout>({
    name: draft.name,
    source: draft.source,
    author: draft.author,
    intro: draft.intro,
    warmup: draft.warmup,
    cardio: draft.cardio,
    version: versionAfterSave(original, author),
    items: draft.items.map((it) => ({
      name: it.name,
      muscles: it.muscles,
      sets: it.sets,
      reps: it.reps,
      kg: it.kg,
      restSec: it.restSec,
      note: it.note,
      videoUrl: it.videoUrl.trim() || null,
      setsDetail: it.setsDetail,
    })),
  });
</script>

<div class="screen tone-training">
  <EditorHeader
    name={draft.name}
    {badge}
    {totals}
    error={fields['name']}
    onname={(name) => set({ name })}
    onback={back}
  />

  <main class="body scroll" bind:this={scroller} onfocusin={(e) => keepFocusedVisible(e, reduce)}>
    {#if !original}
      <section class="block" aria-labelledby="ed-origin">
        <h2 id="ed-origin" class="mono-label">Chi la crea</h2>
        <div class="segmented" role="group" aria-label="Origine della scheda">
          <button type="button" class="seg tap" aria-pressed={draft.source === 'own'} onclick={() => set({ source: 'own' })}>
            Per me <span class="seg-tag mono">TUA</span>
          </button>
          <button type="button" class="seg tap" aria-pressed={draft.source === 'pt'} onclick={() => set({ source: 'pt' })}>
            Come PT <span class="seg-tag mono pt">PT</span>
          </button>
        </div>
        {#if draft.source === 'pt'}
          <label class="mono-label sub" for="ed-author">Nome del PT</label>
          <input
            id="ed-author"
            type="text"
            maxlength="120"
            autocomplete="name"
            placeholder="Il tuo nome, lo vede il cliente"
            value={draft.author}
            aria-invalid={fields['author'] ? 'true' : undefined}
            oninput={(e) => set({ author: e.currentTarget.value })}
          />
          {#if fields['author']}<p class="err" data-error>{fields['author']}</p>{/if}
        {/if}
      </section>
    {:else if kind === 'copy'}
      <NoteBox
        title="Scheda di {original.author || 'un PT'}"
        mark="!"
        text="Salvando crei una tua copia: l'originale resta com'è e potrà ricevere gli aggiornamenti del PT."
      />
    {/if}

    <section class="block" aria-labelledby="ed-days">
      <h2 id="ed-days" class="mono-label">Giorni</h2>
      <div class="days">
        {#each WEEKDAY_INITIALS as letter, i (i)}
          <button
            type="button"
            class="day tap"
            aria-pressed={draft.weekdays.includes(i + 1)}
            aria-label={weekdayName(i + 1)}
            onclick={() => toggleDay(i + 1)}>{letter}</button
          >
        {/each}
      </div>
      <div class="time-row">
        <label class="time-label" for="ed-time">Orario <span class="muted">· facoltativo, per la Home</span></label>
        <input
          id="ed-time"
          class="time"
          type="time"
          value={draft.time ?? ''}
          onchange={(e) => set({ time: parseTimeInput(e.currentTarget.value) })}
        />
        {#if draft.time}
          <button type="button" class="time-clear tap" onclick={() => set({ time: null })}>Togli orario</button>
        {/if}
      </div>
    </section>

    <section class="block" aria-label="Introduzione per il cliente">
      <label class="mono-label" for="ed-intro">Introduzione <span class="muted">· si legge prima di iniziare</span></label>
      <textarea
        id="ed-intro"
        rows="3"
        placeholder="Obiettivo della sessione, istruzioni generali…"
        value={draft.intro}
        oninput={(e) => set({ intro: e.currentTarget.value })}
      ></textarea>
      <button type="button" class="warmup-btn tap" class:has-error={warmupHasErrors} onclick={() => (warmupOpen = true)}>
        <span>Riscaldamento e mobilità</span>
        <span class="mono count">
          {#if warmupHasErrors}<span class="err-inline" data-error>da correggere ·</span>{/if}
          {draft.warmup.length === 1 ? '1 voce' : `${draft.warmup.length} voci`}
          <Icon name="forward" size={16} />
        </span>
      </button>
    </section>

    <section class="block" aria-labelledby="ed-ex">
      <div class="ex-head">
        <h2 id="ed-ex" class="graffiti ex-title">Esercizi</h2>
        {#if draft.items.length > 1}<span class="ex-hint">tieni premuto ⠿ per spostare</span>{/if}
      </div>

      <div class="ex-list" bind:this={listEl}>
        {#each draft.items as item, i (item.key)}
          <ExerciseRow
            {item}
            index={i}
            count={draft.items.length}
            open={openKey === item.key}
            errors={itemErrors(fields, i)}
            ontoggle={() => (openKey = openKey === item.key ? null : item.key)}
            onchange={(next) => setItem(i, next)}
            onpyramidoff={() => pyramidOff(i)}
            onmove={(dir) => moveRow(i, dir)}
            onduplicate={() => duplicateRow(i)}
            onremove={() => removeRow(i)}
            ongrip={(e) => dragRow(e, i)}
          />
        {/each}
      </div>
      {#if fields['items']}<p class="err" data-error>{fields['items']}</p>{/if}

      <button type="button" class="add tap" disabled={!canAdd} onclick={() => (libraryOpen = true)}>
        <Icon name="plus" size={18} stroke={2.4} />Aggiungi esercizio
      </button>
      {#if !canAdd}<p class="muted small">Massimo {MAX_ITEMS.workoutItems} esercizi per scheda.</p>{/if}
    </section>

    <CardioField cardio={draft.cardio} errors={fields} onchange={(cardio) => set({ cardio })} />

    {#if saveError}
      <NoteBox title="Salvataggio non riuscito" mark="!" text={saveError} />
    {/if}
  </main>

  {#if (errorCount > 0 || undo) && !keyboard.open}
    <div class="floating" in:drop>
      {#if undo}
        <div class="undo" role="status">
          <span class="undo-text">«{undo.item.name}» tolto dalla scheda</span>
          <button type="button" class="undo-btn tap" onclick={undoRemove}>Annulla</button>
        </div>
      {/if}
      {#if errorCount > 0}
        <p class="summary" role="alert">
          {errorCount === 1 ? '1 campo da correggere' : `${errorCount} campi da correggere`}
        </p>
      {/if}
    </div>
  {/if}

  <ActionBar hidden={keyboard.open}>
    <Button variant="secondary" tone="neutral" onclick={() => (previewOpen = true)}>Anteprima</Button>
    <Button tone="training" size="lg" disabled={busy} onclick={() => void save()}>
      {#snippet icon()}<Icon name="share" size={18} stroke={2.2} />{/snippet}
      Salva e invia
    </Button>
  </ActionBar>

  <p class="visually-hidden" aria-live="assertive">{announcement}</p>
</div>

<LibrarySheet bind:open={libraryOpen} exercises={exercises.current} {present} onadd={(ex) => void addExercise(ex)} />
<WarmupSheet bind:open={warmupOpen} warmup={draft.warmup} errors={fields} onchange={(warmup) => set({ warmup })} />
<ConfirmSheet bind:open={confirmOpen} title={confirm.title} text={confirm.text} actions={confirm.actions} />
<ConfirmSheet bind:open={savedOpen} title="Scheda salvata" text={savedMessage} actions={SAVED_ACTIONS} />

<BottomSheet bind:open={previewOpen} title="Anteprima" tone="training">
  <p class="muted small">Così la vede chi si allena. Sola lettura.</p>
  <WorkoutPreview workout={preview} inset />
</BottomSheet>

<style>
  .screen {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100dvh;
    overflow: hidden;
    background-image: radial-gradient(circle at 90% 8%, var(--tone-tint), transparent 40%);
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-4) calc(var(--space-5) + var(--safe-right)) calc(140px + var(--safe-bottom))
      calc(var(--space-5) + var(--safe-left));
    /* Il campo in focus non finisce sotto i banner fissi. */
    scroll-padding: var(--space-4) 0 calc(120px + var(--safe-bottom));
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .block > h2 {
    margin: 0;
    font-size: 12px;
  }

  .muted {
    color: var(--muted);
    letter-spacing: 0;
    text-transform: none;
  }

  .small {
    margin: 0;
    font-size: 13px;
  }

  .sub {
    font-size: 10px;
  }

  .segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .seg {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--touch);
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    font-weight: 700;
    font-size: 14px;
  }

  .seg[aria-pressed='true'] {
    border-color: var(--tone);
    background: var(--tone-tint);
  }

  .seg-tag {
    padding: 1px 6px;
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--muted);
    border: 1px solid var(--line-strong);
  }

  .seg-tag.pt {
    color: var(--tip);
    border-color: var(--tip-edge);
  }

  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }

  .day {
    height: var(--touch);
    padding: 0;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    font-weight: 700;
    font-size: 14px;
  }

  .day[aria-pressed='true'] {
    background: var(--tone);
    border-color: var(--tone);
    color: var(--on-tone);
    box-shadow: 0 0 12px var(--tone-glow);
  }

  .time-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-top: var(--space-1);
  }

  .time-label {
    font-size: 14px;
    color: var(--text-2);
  }

  .time {
    width: 7.5em;
    font-family: var(--font-mono);
  }

  .time-clear {
    min-height: var(--touch);
    padding: 0 var(--space-3);
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text-2);
    font-size: 13px;
  }

  textarea,
  input {
    padding: 12px 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 16px;
    line-height: 1.45;
  }

  textarea {
    resize: none;
  }

  input {
    height: var(--touch);
    padding: 0 12px;
  }

  textarea:focus,
  input:focus {
    outline: 1px solid var(--tone);
    outline-offset: 0;
  }

  input[aria-invalid='true'] {
    border-color: var(--tip);
  }

  .warmup-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    padding: 0 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 14px;
  }

  .warmup-btn.has-error {
    border-color: var(--tip-edge);
  }

  .count {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 12px;
    color: var(--muted);
  }

  .err-inline {
    color: var(--tip);
  }

  .ex-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
  }

  .ex-title {
    font-size: 24px;
    color: var(--tone);
  }

  .ex-hint {
    font-size: 12px;
    color: var(--muted);
  }

  .ex-list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 56px;
    background: transparent;
    border: 1px dashed var(--tone);
    color: var(--tone);
    font-weight: 700;
    font-size: 15px;
  }

  .add:disabled {
    opacity: 0.38;
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }

  .floating {
    position: absolute;
    left: calc(var(--space-5) + var(--safe-left));
    right: calc(var(--space-5) + var(--safe-right));
    bottom: calc(92px + var(--safe-bottom));
    z-index: var(--z-banner);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .undo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 4px 4px 4px 14px;
    background: var(--line-strong);
    font-size: 14px;
  }

  .undo-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .undo-btn {
    min-height: var(--touch);
    padding: 0 14px;
    background: transparent;
    border: 0;
    color: var(--progress);
    font-weight: 700;
  }

  .summary {
    margin: 0;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px dashed var(--tip-edge);
    color: var(--tip);
    font-size: 14px;
    font-weight: 700;
  }
</style>
