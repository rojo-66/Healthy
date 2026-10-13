<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../lib/components/Button.svelte';
  import NoteBox from '../lib/components/NoteBox.svelte';
  import TopBanner from '../lib/components/TopBanner.svelte';
  import { newId, nowIso } from '../lib/data/ids';
  import { MAX_TEXT } from '../lib/data/limits';
  import { deleteRun, runsRepo, saveRun } from '../lib/data/repo/runs';
  import { weekdayName } from '../lib/data/schemas/diet-payload';
  import type { Run } from '../lib/data/schemas/runs';
  import { WEEKDAY_INITIALS } from '../lib/diet/calc/calendar';
  import { emptyRunForm, formToRun, runToForm, sameRunForm, type RunFieldErrors, type RunForm } from '../lib/runs/form';
  import { edgeSwipe } from '../lib/sessions/edge-swipe';
  import { parseTimeInput } from '../lib/workouts/format';
  import { keepFocusedVisible, keyboardState } from '../lib/workouts/keyboard.svelte';
  import { prefersReducedMotion } from '../lib/design/transitions';
  import ActionBar from './train/ActionBar.svelte';
  import ConfirmSheet, { type ConfirmAction } from './train/ConfirmSheet.svelte';

  /**
   * Attività "Corsa" (2a): nome, giorni, orario facoltativo, obiettivo (minuti e/o km), nota.
   * Si crea da Allena ("+ Nuova" → Corsa) e si modifica dal menu della corsa (`?id=`).
   */
  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  const reduce = prefersReducedMotion();
  const keyboard = keyboardState();
  const uid = $props.id();

  let original = $state.raw<Run | null>(null);
  let loaded = $state(false);
  let missing = $state(false);
  let form = $state<RunForm>(emptyRunForm());
  let baseline = $state<RunForm>(emptyRunForm());
  let errors = $state<RunFieldErrors>({});
  let busy = $state(false);
  let failure = $state('');

  onMount(() => {
    void (async () => {
      if (id) {
        const run = await runsRepo.get(id);
        if (!run) missing = true;
        else {
          original = run;
          form = runToForm(run);
          baseline = runToForm(run);
        }
      }
      loaded = true;
    })();
  });

  const dirty = $derived(!sameRunForm(form, baseline));

  function toggleDay(day: number) {
    form.weekdays = form.weekdays.includes(day) ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day];
  }

  function leave(message = '') {
    location.hash = message ? `#/allena?corsa=${encodeURIComponent(message)}` : '#/allena';
  }

  async function save() {
    if (busy) return;
    failure = '';
    const now = new Date();
    const result = formToRun(form, { id: original?.id ?? newId(), createdAt: original?.createdAt ?? nowIso(now) }, now);
    if (!result.ok) {
      errors = result.errors;
      return;
    }
    errors = {};
    busy = true;
    try {
      await saveRun(result.value);
      baseline = runToForm(result.value);
      leave(original ? `Corsa «${result.value.name}» aggiornata.` : `Corsa «${result.value.name}» creata.`);
    } catch {
      failure = 'Salvataggio non riuscito: riprova.';
    } finally {
      busy = false;
    }
  }

  // --- Conferme ---
  let confirmOpen = $state(false);
  let confirm = $state.raw<{ title: string; text: string; actions: ConfirmAction[] }>({ title: '', text: '', actions: [] });

  function back() {
    if (!dirty) return leave();
    confirm = {
      title: 'Modifiche non salvate',
      text: `Hai modifiche non salvate a «${form.name.trim() || 'Corsa'}».`,
      actions: [
        { label: 'Salva', kind: 'primary', run: () => void save() },
        { label: 'Esci senza salvare', kind: 'danger', run: () => leave() },
        { label: 'Continua a modificare', kind: 'secondary', run: () => {} },
      ],
    };
    confirmOpen = true;
  }

  function askDelete() {
    if (!original) return;
    const run = original;
    confirm = {
      title: 'Eliminare la corsa?',
      text: `«${run.name}» non sarà più in programma. Le corse già fatte restano nello storico.`,
      actions: [
        {
          label: 'Elimina',
          kind: 'danger',
          run: () =>
            void deleteRun(run.id).then(
              () => leave(`Corsa «${run.name}» eliminata.`),
              () => (failure = 'Non sono riuscito a eliminare la corsa.'),
            ),
        },
        { label: 'Annulla', kind: 'secondary', run: () => {} },
      ],
    };
    confirmOpen = true;
  }
</script>

<div class="screen tone-progress" use:edgeSwipe={{ onback: back, leaves: () => !dirty }}>
  <TopBanner title={original ? original.name : 'Nuova corsa'} tone="progress" onback={back} backLabel="Torna ad Allena" />

  <main class="body scroll" onfocusin={(e) => keepFocusedVisible(e, reduce)}>
    {#if missing}
      <NoteBox title="Corsa non trovata" mark="!" text="Forse è stata eliminata. Torna ad Allena." />
      <Button tone="progress" href="#/allena">Torna ad Allena</Button>
    {:else if loaded}
      <form
        class="form"
        novalidate
        onsubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div class="field">
          <label class="mono-label" for="{uid}-name">Nome</label>
          <input
            id="{uid}-name"
            type="text"
            maxlength={MAX_TEXT.name}
            autocomplete="off"
            placeholder="Es. Corsa lenta, Ripetute"
            bind:value={form.name}
            aria-invalid={errors.name ? 'true' : undefined}
          />
          {#if errors.name}<p class="err" data-error>{errors.name}</p>{/if}
        </div>

        <section class="field" aria-labelledby="{uid}-days">
          <h2 id="{uid}-days" class="mono-label">Giorni</h2>
          <div class="days">
            {#each WEEKDAY_INITIALS as letter, i (i)}
              <button
                type="button"
                class="day tap"
                aria-pressed={form.weekdays.includes(i + 1)}
                aria-label={weekdayName(i + 1)}
                onclick={() => toggleDay(i + 1)}>{letter}</button
              >
            {/each}
          </div>
        </section>

        <div class="field">
          <label class="mono-label" for="{uid}-time">Orario <span class="hint">· facoltativo, per la Home</span></label>
          <div class="time-row">
            <input
              id="{uid}-time"
              class="time"
              type="time"
              value={form.time ?? ''}
              onchange={(e) => (form.time = parseTimeInput(e.currentTarget.value))}
            />
            {#if form.time}
              <button type="button" class="clear tap" onclick={() => (form.time = null)}>Togli orario</button>
            {/if}
          </div>
        </div>

        <fieldset class="field">
          <legend class="mono-label">Obiettivo <span class="hint">· minuti e/o km</span></legend>
          <div class="target">
            <label class="sub">
              <span>Minuti</span>
              <input
                class="num mono"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="off"
                placeholder="30"
                bind:value={form.targetMinutes}
                aria-invalid={errors.targetMinutes || errors.target ? 'true' : undefined}
              />
            </label>
            <label class="sub">
              <span>Km</span>
              <input
                class="num mono"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                placeholder="5"
                bind:value={form.targetKm}
                aria-invalid={errors.targetKm || errors.target ? 'true' : undefined}
              />
            </label>
          </div>
          {#if errors.targetMinutes}<p class="err" data-error>Minuti: {errors.targetMinutes}</p>{/if}
          {#if errors.targetKm}<p class="err" data-error>Km: {errors.targetKm}</p>{/if}
          {#if errors.target}<p class="err" data-error>{errors.target}</p>{/if}
        </fieldset>

        <div class="field">
          <label class="mono-label" for="{uid}-note">Nota <span class="hint">· facoltativa</span></label>
          <textarea
            id="{uid}-note"
            rows="3"
            maxlength={MAX_TEXT.note}
            placeholder="Ritmo, percorso, riscaldamento…"
            bind:value={form.note}
          ></textarea>
          {#if errors.note}<p class="err" data-error>{errors.note}</p>{/if}
        </div>

        {#if failure}<NoteBox title="Non riuscito" mark="!" text={failure} />{/if}

        {#if original}
          <Button tone="tip" variant="ghost" block onclick={askDelete}>Elimina corsa</Button>
        {/if}
      </form>
    {/if}
  </main>

  {#if loaded && !missing}
    <ActionBar hidden={keyboard.open} tone="progress">
      <Button variant="secondary" tone="neutral" onclick={back}>Annulla</Button>
      <Button tone="progress" size="lg" disabled={busy} onclick={() => void save()}>Salva corsa</Button>
    </ActionBar>
  {/if}
</div>

<ConfirmSheet bind:open={confirmOpen} title={confirm.title} text={confirm.text} actions={confirm.actions} />

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
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--space-4) calc(var(--space-5) + var(--safe-right)) calc(140px + var(--safe-bottom))
      calc(var(--space-5) + var(--safe-left));
    scroll-padding: var(--space-4) 0 calc(120px + var(--safe-bottom));
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .field > h2 {
    margin: 0;
  }

  legend {
    padding: 0;
    margin-bottom: var(--space-2);
  }

  .hint {
    letter-spacing: 0;
    text-transform: none;
    color: var(--muted);
  }

  input,
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--touch);
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 0;
    background: var(--bg);
    color: var(--text);
    font-size: 16px;
  }

  textarea {
    padding: 10px 12px;
    resize: none;
    line-height: 1.45;
  }

  input[aria-invalid='true'] {
    border-color: var(--tip);
  }

  input:focus,
  textarea:focus {
    outline: 1px solid var(--tone);
    outline-offset: 0;
  }

  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }

  .day {
    min-height: var(--touch);
    padding: 0;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    font-weight: 700;
  }

  .day[aria-pressed='true'] {
    background: var(--tone);
    border-color: var(--tone);
    color: var(--on-tone);
  }

  .time-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .time {
    width: auto;
    min-width: 140px;
  }

  .clear {
    min-height: var(--touch);
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text-2);
    font-size: 13px;
  }

  .target {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .sub {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: var(--text-2);
  }

  .num {
    font-weight: 700;
    text-align: center;
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }
</style>
