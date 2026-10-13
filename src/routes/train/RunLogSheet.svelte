<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { newId, nowIso } from '../../lib/data/ids';
  import { MAX_TEXT } from '../../lib/data/limits';
  import { deleteRunLog, saveRunLog } from '../../lib/data/repo/runs';
  import type { Run, RunLog } from '../../lib/data/schemas/runs';
  import {
    emptyLogForm,
    formDistanceKm,
    formDurationSec,
    formToLog,
    logToForm,
    type LogFieldErrors,
    type RunLogForm,
  } from '../../lib/runs/form';
  import { paceLabel, runLogLabel, targetLabel } from '../../lib/runs/format';
  import RpePicker from '../session/RpePicker.svelte';

  /**
   * "Segna come fatta" una corsa (2a): durata, distanza facoltativa, passo calcolato dal vivo, RPE, nota, data.
   * Niente Readiness né cronometro (decisione 2a). Con una corsa già segnata: sola lettura con Modifica / Elimina.
   */
  interface Props {
    open: boolean;
    /** Corsa pianificata da segnare (nuova registrazione). */
    run: Run | null;
    /** Corsa già fatta da vedere o modificare. */
    log: RunLog | null;
    /** Giorno proposto per una nuova registrazione (di solito oggi). */
    date: string;
    /** Oggi (`AAAA-MM-GG`): la data non può andare oltre. */
    today: string;
    onsaved?: (message: string) => void;
  }

  let { open = $bindable(false), run, log, date, today, onsaved }: Props = $props();

  const uid = $props.id();
  let editing = $state(false);
  let form = $state<RunLogForm>(emptyLogForm(''));
  let errors = $state<LogFieldErrors>({});
  let busy = $state(false);
  let failure = $state('');
  let askDelete = $state(false);

  // Ogni apertura riparte dai dati giusti: una corsa nuova parte vuota, una già fatta in sola lettura.
  $effect(() => {
    if (!open) return;
    form = log ? logToForm(log) : emptyLogForm(date);
    editing = !log;
    errors = {};
    failure = '';
    askDelete = false;
  });

  const name = $derived(log?.runName ?? run?.name ?? 'Corsa');
  const target = $derived(run ? targetLabel(run) : '');
  const durationSec = $derived(formDurationSec(form));
  const km = $derived(formDistanceKm(form));
  const pace = $derived(durationSec !== null && km !== null ? paceLabel(durationSec, km) : '—');

  async function save() {
    if (busy) return;
    const result = formToLog(
      form,
      {
        id: log?.id ?? newId(),
        runId: log ? log.runId : (run?.id ?? null),
        runName: name,
        loggedAt: log?.loggedAt ?? nowIso(),
      },
      today,
    );
    if (!result.ok) {
      errors = result.errors;
      return;
    }
    busy = true;
    try {
      await saveRunLog(result.value);
      open = false;
      onsaved?.(log ? `Corsa aggiornata: ${runLogLabel(result.value)}.` : `Corsa segnata ✓ ${runLogLabel(result.value)}.`);
    } catch {
      failure = 'Salvataggio non riuscito: riprova.';
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!log || busy) return;
    busy = true;
    try {
      await deleteRunLog(log.id);
      open = false;
      onsaved?.('Corsa eliminata dallo storico.');
    } catch {
      failure = 'Non sono riuscito a eliminare la corsa.';
    } finally {
      busy = false;
    }
  }

  const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  function dateLabel(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
  }
</script>

<BottomSheet bind:open title={name} tone="progress">
  <div class="sheet tone-progress" data-testid="run-log-sheet">
    {#if target}<p class="mono-label target">Obiettivo {target}</p>{/if}

    {#if log && !editing}
      <dl class="facts">
        <div><dt>Data</dt><dd>{dateLabel(log.date)}</dd></div>
        <div><dt>Corsa</dt><dd class="mono">{runLogLabel(log)}</dd></div>
      </dl>
      {#if log.note}<NoteBox title="Nota" text={log.note} />{/if}
      <div class="buttons">
        <Button tone="progress" block onclick={() => (editing = true)}>Modifica</Button>
        {#if askDelete}
          <Button tone="tip" variant="secondary" block disabled={busy} onclick={() => void remove()}>Elimina davvero</Button>
        {:else}
          <Button tone="tip" variant="ghost" block onclick={() => (askDelete = true)}>Elimina</Button>
        {/if}
      </div>
    {:else}
      <form
        class="form"
        novalidate
        onsubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div class="field">
          <label class="mono-label" for="{uid}-date">Data</label>
          <input id="{uid}-date" type="date" max={today} bind:value={form.date} aria-invalid={errors.date ? 'true' : undefined} />
          {#if errors.date}<p class="err">{errors.date}</p>{/if}
        </div>

        <fieldset class="field">
          <legend class="mono-label">Durata</legend>
          <div class="duration">
            <input
              class="num mono"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              aria-label="Minuti"
              placeholder="min"
              bind:value={form.minutes}
              aria-invalid={errors.duration ? 'true' : undefined}
            />
            <span class="colon mono" aria-hidden="true">:</span>
            <input
              class="num mono"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              aria-label="Secondi"
              placeholder="s"
              bind:value={form.seconds}
              aria-invalid={errors.duration ? 'true' : undefined}
            />
          </div>
          {#if errors.duration}<p class="err">{errors.duration}</p>{/if}
        </fieldset>

        <div class="field">
          <label class="mono-label" for="{uid}-km">Distanza (km) <span class="hint">· facoltativa</span></label>
          <input
            id="{uid}-km"
            class="num mono"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="es. 5,2"
            bind:value={form.distanceKm}
            aria-invalid={errors.distanceKm ? 'true' : undefined}
          />
          {#if errors.distanceKm}<p class="err">{errors.distanceKm}</p>{/if}
        </div>

        <p class="pace mono" data-testid="run-pace" aria-live="polite">PASSO <b>{pace}</b></p>

        <div class="field">
          <RpePicker value={form.rpe} onpick={(rpe) => (form.rpe = rpe)} />
          {#if errors.rpe}<p class="err">{errors.rpe}</p>{/if}
        </div>

        <div class="field">
          <label class="mono-label" for="{uid}-note">Nota <span class="hint">· facoltativa</span></label>
          <textarea id="{uid}-note" rows="3" maxlength={MAX_TEXT.note} placeholder="Percorso, sensazioni…" bind:value={form.note}></textarea>
        </div>

        {#if failure}<NoteBox title="Non riuscito" mark="!" text={failure} />{/if}

        <Button type="submit" tone="progress" size="lg" block disabled={busy}>{log ? 'Salva modifiche' : 'Salva corsa ✓'}</Button>
      </form>
    {/if}
  </div>
</BottomSheet>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .target {
    margin: 0;
    color: var(--tone);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
  }

  .hint {
    letter-spacing: 0;
    text-transform: none;
    color: var(--muted);
  }

  .duration {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2);
  }

  .colon {
    font-size: 20px;
    font-weight: 700;
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

  .num {
    font-weight: 700;
    text-align: center;
  }

  input[aria-invalid='true'] {
    border-color: var(--tip);
  }

  input:focus,
  textarea:focus {
    outline: 1px solid var(--tone);
    outline-offset: 0;
  }

  .pace {
    margin: 0;
    font-size: 13px;
    letter-spacing: 1px;
    color: var(--muted);
  }

  .pace b {
    font-size: 20px;
    color: var(--tone);
  }

  .facts {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
  }

  .facts div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: 14px;
  }

  .facts dt {
    color: var(--muted);
  }

  .facts dd {
    margin: 0;
    text-align: right;
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }
</style>
