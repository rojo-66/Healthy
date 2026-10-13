<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../../lib/components/Button.svelte';
  import NoteBox from '../../../lib/components/NoteBox.svelte';
  import type { CustomExerciseFields } from '../../../lib/data/repo/exercises';
  import type { Exercise } from '../../../lib/data/schemas/exercises';
  import { EQUIPMENT, MUSCLES } from '../../../lib/workouts/library/muscles';

  interface Props {
    /** Esercizio da modificare; `null` = nuovo. */
    exercise: Exercise | null;
    /** Nome proposto per uno nuovo (quello cercato). */
    suggestedName?: string;
    /** Tipo proposto per uno nuovo (chip "Cardio" attivo → cardio). */
    suggestedKind?: 'strength' | 'cardio';
    busy: boolean;
    /** Errori del salvataggio (vuoto = nessuno). */
    errors: readonly string[];
    /** Avviso prima di eliminare (schede che lo usano); `null` = non ancora chiesto. */
    deleteWarning: string | null;
    onsave: (fields: CustomExerciseFields) => void;
    oncancel: () => void;
    onaskdelete?: () => void;
    onconfirmdelete?: () => void;
  }

  let {
    exercise,
    suggestedName = '',
    suggestedKind = 'strength',
    busy,
    errors,
    deleteWarning,
    onsave,
    oncancel,
    onaskdelete,
    onconfirmdelete,
  }: Props = $props();

  const uid = $props.id();
  let name = $state(untrack(() => exercise?.name ?? suggestedName));
  // Il tipo si sceglie solo creando: le schede che usano un esercizio ne hanno una copia del tipo giusto.
  let kind = $state<'strength' | 'cardio'>(untrack(() => exercise?.kind ?? suggestedKind));
  let muscles = $state<string[]>(untrack(() => [...(exercise?.muscles ?? [])]));
  let equipment = $state<string>(untrack(() => exercise?.equipment || 'Macchina'));
  let videoUrl = $state(untrack(() => exercise?.videoUrl ?? ''));

  function toggleMuscle(m: string) {
    muscles = muscles.includes(m) ? muscles.filter((x) => x !== m) : [...muscles, m];
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    onsave({ name, kind, muscles, equipment, videoUrl });
  }
</script>

<form class="form" onsubmit={submit} novalidate>
  <div class="field">
    <label class="mono-label" for="{uid}-name">Nome dell'esercizio</label>
    <input id="{uid}-name" type="text" bind:value={name} maxlength="120" autocomplete="off" placeholder="Es. Crunch alla macchina" />
  </div>

  <fieldset class="field">
    <legend class="mono-label">Tipo</legend>
    {#if exercise}
      <p class="kind-fixed">{kind === 'cardio' ? 'Cardio · minuti, distanza, velocità…' : 'Forza · serie, ripetizioni, kg'}</p>
    {:else}
      <div class="chips" role="group" aria-label="Tipo di esercizio">
        <button type="button" class="chip tap" aria-pressed={kind === 'strength'} onclick={() => (kind = 'strength')}>Forza</button>
        <button type="button" class="chip tap" aria-pressed={kind === 'cardio'} onclick={() => (kind = 'cardio')}>Cardio</button>
      </div>
    {/if}
  </fieldset>

  <fieldset class="field">
    <legend class="mono-label"
      >Muscoli <span class="hint">· {kind === 'cardio' ? 'facoltativi' : 'il primo scelto è il principale'}</span></legend
    >
    <div class="chips" role="group" aria-label="Muscoli">
      {#each MUSCLES as m (m)}
        {@const pos = muscles.indexOf(m)}
        <button type="button" class="chip tap" aria-pressed={pos !== -1} onclick={() => toggleMuscle(m)}>
          {m}{#if pos === 0}<span class="main-tag"> · principale</span>{/if}
        </button>
      {/each}
    </div>
  </fieldset>

  <fieldset class="field">
    <legend class="mono-label">Attrezzo</legend>
    <div class="chips" role="group" aria-label="Attrezzo">
      {#each EQUIPMENT as eq (eq)}
        <button type="button" class="chip tap" aria-pressed={equipment === eq} onclick={() => (equipment = eq)}>{eq}</button>
      {/each}
    </div>
  </fieldset>

  <div class="field">
    <label class="mono-label" for="{uid}-video">Link video (facoltativo)</label>
    <input
      id="{uid}-video"
      type="url"
      inputmode="url"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      bind:value={videoUrl}
      placeholder="https://…"
    />
  </div>

  {#if errors.length > 0}
    <NoteBox title="Da correggere" mark="!">
      <ul class="errors">
        {#each errors as message, i (i)}<li>{message}</li>{/each}
      </ul>
    </NoteBox>
  {/if}

  <div class="buttons">
    <Button type="submit" tone="training" block disabled={busy}>{exercise ? 'Salva modifiche' : 'Crea e aggiungi'}</Button>
    <Button variant="secondary" tone="neutral" block onclick={oncancel}>Annulla</Button>
  </div>

  {#if exercise && onaskdelete}
    {#if deleteWarning}
      <NoteBox title="Eliminare l'esercizio?" mark="!" text={deleteWarning} />
      <Button tone="tip" variant="secondary" block disabled={busy} onclick={onconfirmdelete}>Elimina comunque</Button>
    {:else}
      <Button tone="tip" variant="ghost" block disabled={busy} onclick={onaskdelete}>Elimina esercizio</Button>
    {/if}
  {/if}
</form>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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

  legend {
    padding: 0;
    margin-bottom: var(--space-2);
  }

  .kind-fixed {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .hint {
    letter-spacing: 0;
    text-transform: none;
  }

  input {
    height: 46px;
    padding: 0 14px;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 16px;
  }

  input:focus {
    outline: 1px solid var(--training);
    outline-offset: 0;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    min-height: var(--touch);
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 700;
  }

  .chip[aria-pressed='true'] {
    background: var(--training);
    border-color: var(--training);
    color: var(--on-tone);
  }

  .main-tag {
    font-weight: 500;
  }

  .errors {
    margin: 0;
    padding-left: 1.2em;
    font-size: 14px;
  }

  .buttons {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-2);
  }
</style>
