<script lang="ts">
  import { ValidationError } from '../../lib/data/errors';
  import { MAX_TEXT } from '../../lib/data/limits';
  import { setWorkoutAuthor } from '../../lib/data/repo/settings';
  import type { WorkoutAuthor } from '../../lib/data/schemas/workout-draft';

  // Impostazioni delle schede (prima nell'editor, M4): il mio nome come PT e l'origine delle nuove schede.
  interface Props {
    author: WorkoutAuthor;
    /** Nome del profilo, suggerito se il nome come PT è vuoto. */
    profileName: string;
  }

  let { author, profileName }: Props = $props();

  let status = $state('');
  let error = $state('');
  // Il campo parte dal valore salvato; poi è dell'utente finché non lo salva.
  let name = $state('');
  let editing = $state(false);
  $effect(() => {
    if (!editing) name = author.name;
  });

  async function save(next: WorkoutAuthor, done: string) {
    error = '';
    try {
      await setWorkoutAuthor(next);
      status = done;
    } catch (e) {
      error = e instanceof ValidationError ? e.errors.join(' ') : 'Salvataggio non riuscito: riprova.';
    }
  }

  function saveName() {
    editing = false;
    if (name.trim() === author.name) return;
    void save({ ...author, name }, 'Nome salvato.');
  }

  function setSource(source: WorkoutAuthor['lastSource']) {
    if (source === author.lastSource) return;
    void save({ ...author, name: author.name, lastSource: source }, 'Origine predefinita salvata.');
  }
</script>

<div class="settings">
  <div class="field">
    <label for="as-name">Il tuo nome come PT</label>
    <input
      id="as-name"
      type="text"
      autocomplete="name"
      maxlength={MAX_TEXT.name}
      placeholder={profileName || 'es. Marco'}
      bind:value={name}
      onfocus={() => (editing = true)}
      onblur={saveName}
      onkeydown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
    <p class="hint">
      Va sulle schede che crei come PT. Le schede con questo autore sono "tue": modificarle crea una nuova versione.
    </p>
  </div>

  <fieldset>
    <legend>Le nuove schede sono</legend>
    <div class="options">
      <button type="button" class="opt tap" aria-pressed={author.lastSource === 'own'} onclick={() => setSource('own')}>
        Per me
      </button>
      <button type="button" class="opt tap" aria-pressed={author.lastSource === 'pt'} onclick={() => setSource('pt')}>
        Come PT
      </button>
    </div>
    <p class="hint">Nell'editor puoi sempre cambiarla per una singola scheda.</p>
  </fieldset>

  <p class="status" role="status" aria-live="polite">{status}</p>
  {#if error}<p class="err">{error}</p>{/if}
</div>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field,
  fieldset {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  label,
  legend {
    padding: 0;
    font-size: 13px;
    color: var(--text-2);
  }

  input {
    width: 100%;
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-size: 16px;
  }

  input:focus {
    outline: 2px solid var(--progress);
    outline-offset: 0;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .opt {
    min-height: var(--touch);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-size: 14px;
    color: var(--text-2);
  }

  .opt[aria-pressed='true'] {
    border-color: var(--progress);
    background: var(--progress-tint);
    color: var(--progress);
    font-weight: 700;
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .status {
    min-height: 1.45em;
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .err {
    margin: 0;
    font-size: 14px;
    color: var(--tip);
  }
</style>
