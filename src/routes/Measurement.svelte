<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../lib/components/Button.svelte';
  import NoteBox from '../lib/components/NoteBox.svelte';
  import TopBanner from '../lib/components/TopBanner.svelte';
  import { MAX_TEXT } from '../lib/data/limits';
  import { ValidationError } from '../lib/data/errors';
  import { deleteMeasurement, listMeasurementsByDate, saveMeasurement } from '../lib/data/repo/measurements';
  import { getProfile } from '../lib/data/repo/profile';
  import type { Measurement } from '../lib/data/schemas/measurements';
  import type { Profile } from '../lib/data/schemas/profile';
  import { toIsoDate } from '../lib/diet/calc/calendar';
  import { prefersReducedMotion } from '../lib/design/transitions';
  import type { ValueField } from '../lib/profile/consistency';
  import {
    emptyForm,
    FORM_GROUPS,
    formFromMeasurement,
    previousMeasurement,
    readMeasurementForm,
    suggestion,
    type FieldGroup,
    type MeasurementForm,
  } from '../lib/profile/form';
  import { metricWithUnit, numericDate } from '../lib/profile/format';
  import { deriveMetrics, type MetricKey } from '../lib/profile/metrics';
  import { routeHref } from '../lib/routes';
  import { keepFocusedVisible, keyboardState } from '../lib/workouts/keyboard.svelte';
  import ActionBar from './train/ActionBar.svelte';
  import ConfirmSheet from './train/ConfirmSheet.svelte';

  // Inserimento veloce di una misura (SPEC § 5.6): solo la data è obbligatoria, più almeno un valore.
  interface Props {
    /** Misura da modificare; `null` = nuova. */
    id: string | null;
  }

  let { id }: Props = $props();

  const reduce = prefersReducedMotion();
  const keyboard = keyboardState();
  const today = toIsoDate(new Date());
  const backHref = routeHref('/profilo');

  let loaded = $state(false);
  let list = $state.raw<Measurement[]>([]);
  let profile = $state.raw<Profile | undefined>(undefined);
  let original = $state.raw<Measurement | undefined>(undefined);
  let form = $state<MeasurementForm>(emptyForm(today));
  let tried = $state(false);
  let busy = $state(false);
  let saveErrors = $state<readonly string[]>([]);
  let confirmDelete = $state(false);

  onMount(async () => {
    [list, profile] = await Promise.all([listMeasurementsByDate(), getProfile()]);
    original = id ? list.find((m) => m.id === id) : undefined;
    if (original) form = formFromMeasurement(original);
    loaded = true;
  });

  const result = $derived(readMeasurementForm(form, { today, existing: list, id: original?.id ?? null }));
  const errors = $derived(tried ? result.errors : {});
  const errorCount = $derived(Object.keys(errors).length);

  /** Valori della misura precedente come suggerimento nei campi (segnaposto, mai salvati). */
  const previous = $derived(previousMeasurement(list, form.date || today, original?.id ?? null));

  // Valori calcolati dal vivo, con i soli campi già validi.
  const live = $derived.by(() => {
    const value = result.value ?? readMeasurementForm(form, { today: '9999-12-31', existing: [], id: null }).value;
    if (!value) return null;
    return deriveMetrics({ ...value, id: 'live' }, profile);
  });

  const COMPUTED: Partial<Record<FieldGroup['id'], readonly MetricKey[]>> = {
    base: ['bmi'],
    composition: ['fmKg', 'fmPct', 'ffmKg', 'ffmPct', 'bcmPct'],
    water: ['ecwTbw'],
  };

  const COMPUTED_LABELS: Partial<Record<MetricKey, string>> = {
    bmi: 'BMI',
    fmKg: 'FM',
    fmPct: 'FM',
    ffmKg: 'FFM',
    ffmPct: 'FFM',
    bcmPct: 'BCM su FFM',
    ecwTbw: 'ECW/TBW',
  };

  function computedText(group: FieldGroup['id']): string {
    if (!live) return '';
    const parts = (COMPUTED[group] ?? []).flatMap((key) => {
      const v = live[key];
      return v && v.origin === 'calculated' ? [`${COMPUTED_LABELS[key]} ${metricWithUnit(key, v.value)}`] : [];
    });
    return parts.length > 0 ? `Calcolati: ${parts.join(' · ')}` : '';
  }

  function inputId(key: ValueField): string {
    return `ms-${key}`;
  }

  async function save() {
    tried = true;
    saveErrors = [];
    if (!result.value || busy) {
      // Porta in vista il primo campo con errore.
      queueMicrotask(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }));
      return;
    }
    busy = true;
    try {
      await saveMeasurement({ ...result.value, id: original?.id });
      location.hash = backHref;
    } catch (error) {
      saveErrors = error instanceof ValidationError ? error.errors : ['Salvataggio non riuscito: riprova.'];
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!original) return;
    await deleteMeasurement(original.id);
    location.hash = backHref;
  }
</script>

<div class="screen tone-progress">
  <TopBanner title={original ? 'Modifica misura' : 'Nuova misura'} tone="progress" {backHref} backLabel="Torna al profilo" />

  <main class="body scroll" onfocusin={(e) => keepFocusedVisible(e, reduce)}>
    {#if !loaded}
      <p class="hint">Carico…</p>
    {:else if id && !original}
      <NoteBox title="Misura non trovata" mark="!" text="Forse è stata eliminata. Torna al profilo per vedere lo storico." />
      <Button tone="progress" href={backHref}>Torna al profilo</Button>
    {:else}
      <p class="hint">Serve solo la data e almeno un valore. Lascia vuoto ciò che non hai: non conta come zero.</p>

      {#if tried && errorCount > 0}
        <p class="summary" role="alert">{errorCount === 1 ? '1 campo da correggere' : `${errorCount} campi da correggere`}</p>
      {/if}

      {#each FORM_GROUPS as group (group.id)}
        <fieldset class="group" data-testid="group-{group.id}">
          <legend class="mono-label">{group.title}</legend>
          {#if group.id === 'base'}
            <div class="field">
              <label for="ms-date">Data</label>
              <input
                id="ms-date"
                type="date"
                max={today}
                required
                aria-invalid={errors.date ? 'true' : undefined}
                aria-describedby={errors.date ? 'ms-date-err' : undefined}
                bind:value={form.date}
              />
              {#if errors.date}<p class="err" id="ms-date-err">{errors.date}</p>{/if}
            </div>
          {/if}
          <div class="fields" class:single={group.fields.length === 1}>
            {#each group.fields as f (f.key)}
              <div class="field">
                <label for={inputId(f.key)}>{f.label} <span class="unit">({f.unit})</span></label>
                <input
                  id={inputId(f.key)}
                  type="text"
                  inputmode={f.integer ? 'numeric' : 'decimal'}
                  enterkeyhint="next"
                  autocomplete="off"
                  placeholder={suggestion(previous, f.key)}
                  aria-invalid={errors[f.key] ? 'true' : undefined}
                  aria-describedby={errors[f.key] ? `${inputId(f.key)}-err` : undefined}
                  bind:value={form.values[f.key]}
                />
                {#if errors[f.key]}<p class="err" id="{inputId(f.key)}-err">{errors[f.key]}</p>{/if}
              </div>
            {/each}
          </div>
          {#if computedText(group.id)}
            <p class="computed mono" data-testid="computed-{group.id}">{computedText(group.id)}</p>
          {/if}
        </fieldset>
      {/each}

      {#if errors.values}<p class="err" role="alert">{errors.values}</p>{/if}

      {#if result.warnings.length > 0}
        <NoteBox title="Controlla i valori" mark="!">
          {#each result.warnings as w, i (i)}<p class="warn">{w}</p>{/each}
          <p class="warn muted">Puoi salvare lo stesso.</p>
        </NoteBox>
      {/if}

      <fieldset class="group">
        <legend class="mono-label">Note</legend>
        <div class="field">
          <label for="ms-notes">Lettura del nutrizionista</label>
          <textarea
            id="ms-notes"
            rows="4"
            maxlength={MAX_TEXT.note}
            placeholder="Cosa ti ha detto il nutrizionista di questa misura (facoltativo)"
            bind:value={form.notes}
          ></textarea>
          {#if errors.notes}<p class="err">{errors.notes}</p>{/if}
        </div>
      </fieldset>

      {#if saveErrors.length > 0}
        <NoteBox title="Misura non salvata" mark="!">
          {#each saveErrors as e, i (i)}<p class="warn">{e}</p>{/each}
        </NoteBox>
      {/if}

      {#if original}
        <Button tone="tip" variant="secondary" block onclick={() => (confirmDelete = true)}>Elimina misura</Button>
      {/if}
    {/if}
  </main>

  {#if loaded && (!id || original)}
    <ActionBar hidden={keyboard.open} tone="progress">
      <Button variant="ghost" href={backHref}>Annulla</Button>
      <Button tone="progress" disabled={busy} onclick={save}>Salva misura</Button>
    </ActionBar>
  {/if}
</div>

<ConfirmSheet
  bind:open={confirmDelete}
  tone="progress"
  title="Eliminare la misura?"
  text={original ? `La misura del ${numericDate(original.date)} viene cancellata da questo telefono. Non si può annullare.` : ''}
  actions={[
    { label: 'Elimina', kind: 'danger', run: () => void remove() },
    { label: 'Annulla', kind: 'secondary', run: () => {} },
  ]}
/>

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
    padding: var(--space-4) calc(var(--space-5) + var(--safe-right)) calc(120px + var(--safe-bottom))
      calc(var(--space-5) + var(--safe-left));
    /* Il campo in focus non finisce sotto il banner fisso. */
    scroll-padding: var(--space-4) 0 calc(100px + var(--safe-bottom));
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    margin: 0;
    padding: var(--space-4);
    border: 0;
    background: var(--surface);
  }

  legend {
    float: left;
    width: 100%;
    padding: 0;
    font-size: 12px;
    color: var(--progress);
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .fields.single {
    grid-template-columns: minmax(0, 1fr);
  }

  /* Etichette su due righe: i campi restano allineati in basso. */
  .fields .field {
    justify-content: flex-end;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  label {
    font-size: 13px;
    color: var(--text-2);
  }

  .unit {
    color: var(--muted);
  }

  input,
  textarea {
    width: 100%;
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-family: var(--font-mono);
    font-size: 16px;
  }

  textarea {
    padding: var(--space-3);
    font-family: var(--font-body);
    line-height: 1.45;
    resize: vertical;
  }

  /* Suggerimento dalla misura precedente: più piccolo e in corsivo, non sembra un dato inserito. */
  input::placeholder,
  textarea::placeholder {
    font-family: var(--font-body);
    font-size: 13px;
    font-style: italic;
    color: var(--muted);
    opacity: 1;
  }

  input:focus,
  textarea:focus {
    outline: 2px solid var(--progress);
    outline-offset: 0;
  }

  input[aria-invalid='true'] {
    border-color: var(--tip);
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }

  .summary {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--tip);
  }

  .computed {
    margin: 0;
    font-size: 12px;
    color: var(--text-2);
  }

  .warn {
    margin: 0;
    font-size: 14px;
  }

  .muted {
    color: var(--text-2);
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
