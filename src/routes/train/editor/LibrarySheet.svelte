<script lang="ts">
  import BottomSheet from '../../../lib/components/BottomSheet.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import { ValidationError } from '../../../lib/data/errors';
  import {
    createCustomExercise,
    customExerciseUsage,
    deleteCustomExercise,
    updateCustomExercise,
    type CustomExerciseFields,
  } from '../../../lib/data/repo/exercises';
  import type { Exercise } from '../../../lib/data/schemas/exercises';
  import { deleteWarning } from '../../../lib/workouts/library/custom';
  import { COMMON_IDS } from '../../../lib/workouts/library/data';
  import { MUSCLES } from '../../../lib/workouts/library/muscles';
  import { searchExercises } from '../../../lib/workouts/library/search';
  import CustomExerciseForm from './CustomExerciseForm.svelte';

  interface Props {
    open: boolean;
    exercises: readonly Exercise[];
    /** Esercizi già nella scheda (✓). */
    present: ReadonlySet<string>;
    onadd: (exercise: Exercise) => void;
  }

  let { open = $bindable(false), exercises, present, onadd }: Props = $props();

  const PAGE = 60;
  let query = $state('');
  let muscle = $state<string | null>(null);
  /** Chip "Cardio" (2a): solo esercizi cardio. Esclude il filtro per muscolo. */
  let cardioOnly = $state(false);
  let limit = $state(PAGE);
  let status = $state('');

  type View = { kind: 'list' } | { kind: 'form'; exercise: Exercise | null };
  let view = $state<View>({ kind: 'list' });
  let busy = $state(false);
  let formErrors = $state<readonly string[]>([]);
  let warning = $state<string | null>(null);

  // Prima i tuoi esercizi e quelli comuni (con nome italiano), poi il resto della libreria.
  const results = $derived(
    searchExercises(
      exercises,
      query,
      muscle,
      (ex) => ex.custom || ex.kind === 'cardio' || COMMON_IDS.has(ex.id),
      cardioOnly ? 'cardio' : null,
    ),
  );
  const shown = $derived(results.slice(0, limit));
  const title = $derived(view.kind === 'list' ? 'Libreria' : view.exercise ? 'Modifica esercizio' : 'Nuovo esercizio');

  // Nuova ricerca o nuovo filtro: si riparte dai primi risultati.
  function setQuery(value: string) {
    query = value;
    limit = PAGE;
  }

  function setMuscle(value: string | null) {
    muscle = value;
    cardioOnly = false;
    limit = PAGE;
  }

  function toggleCardio() {
    cardioOnly = !cardioOnly;
    muscle = null;
    limit = PAGE;
  }

  /** "Petto · Tricipiti · Bilanciere"; cardio "cardio · Macchina". */
  function metaOf(ex: Exercise): string {
    const head = ex.kind === 'cardio' ? ['cardio', ...ex.muscles] : ex.muscles;
    return [...head, ex.equipment, ex.custom ? 'tuo' : ''].filter(Boolean).join(' · ');
  }

  function openForm(exercise: Exercise | null) {
    formErrors = [];
    warning = null;
    status = '';
    view = { kind: 'form', exercise };
  }

  function backToList(message = '') {
    view = { kind: 'list' };
    status = message;
  }

  async function run(task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try {
      await task();
    } catch (error) {
      formErrors = error instanceof ValidationError ? error.errors : ['Salvataggio non riuscito: riprova.'];
    } finally {
      busy = false;
    }
  }

  function save(fields: CustomExerciseFields) {
    const editing = view.kind === 'form' ? view.exercise : null;
    void run(async () => {
      if (editing) {
        const saved = await updateCustomExercise(editing.id, fields);
        backToList(`«${saved.name}» aggiornato. Le schede che lo usano restano come sono.`);
      } else {
        const created = await createCustomExercise(fields);
        view = { kind: 'list' };
        onadd(created);
      }
    });
  }

  function askDelete() {
    const editing = view.kind === 'form' ? view.exercise : null;
    if (!editing) return;
    void run(async () => {
      warning = deleteWarning(editing, await customExerciseUsage(editing.id));
    });
  }

  function confirmDelete() {
    const editing = view.kind === 'form' ? view.exercise : null;
    if (!editing) return;
    void run(async () => {
      await deleteCustomExercise(editing.id);
      backToList(`«${editing.name}» eliminato dalla libreria.`);
    });
  }

  // Alla prossima apertura si riparte da capo (come nel mockup): niente filtri dimenticati.
  function closed() {
    view = { kind: 'list' };
    status = '';
    query = '';
    muscle = null;
    cardioOnly = false;
    limit = PAGE;
  }
</script>

<BottomSheet bind:open {title} tone="training" onclose={closed}>
  {#if view.kind === 'list'}
    <div class="lib">
      <div class="search-bar">
        <label class="visually-hidden" for="lib-search">Cerca esercizio</label>
        <input
          id="lib-search"
          type="search"
          autocomplete="off"
          enterkeyhint="search"
          placeholder="Cerca: panca, squat, tapis…"
          value={query}
          oninput={(e) => setQuery(e.currentTarget.value)}
        />
        <div class="chips scroll-x" role="group" aria-label="Filtra per muscolo principale">
          <button type="button" class="chip tap" aria-pressed={muscle === null && !cardioOnly} onclick={() => setMuscle(null)}
            >Tutti</button
          >
          <button type="button" class="chip tap" aria-pressed={cardioOnly} onclick={toggleCardio}>Cardio</button>
          {#each MUSCLES as m (m)}
            <button type="button" class="chip tap" aria-pressed={muscle === m} onclick={() => setMuscle(muscle === m ? null : m)}>{m}</button>
          {/each}
        </div>
      </div>

      <p class="count mono" role="status" aria-live="polite">
        {status || (results.length === 1 ? '1 esercizio' : `${results.length} esercizi`)}
      </p>

      <ul class="results">
        {#each shown as ex (ex.id)}
          {@const inIt = present.has(ex.id)}
          <li class="result">
            <span class="r-text">
              <span class="r-name">{ex.name}</span>
              <span class="r-meta">{metaOf(ex)}</span>
            </span>
            {#if ex.custom}
              <button type="button" class="r-edit tap" aria-label="Modifica {ex.name}" onclick={() => openForm(ex)}>
                <Icon name="edit" size={18} />
              </button>
            {/if}
            <button
              type="button"
              class="r-add tap"
              class:in={inIt}
              aria-label={inIt ? `${ex.name} è già nella scheda` : `Aggiungi ${ex.name}`}
              aria-disabled={inIt}
              onclick={() => !inIt && onadd(ex)}
            >
              {#if inIt}<Icon name="check" size={18} />{:else}<Icon name="plus" size={20} stroke={2.4} />{/if}
            </button>
          </li>
        {:else}
          <li class="none">Nessun esercizio trovato.</li>
        {/each}
      </ul>

      {#if results.length > shown.length}
        <button type="button" class="more tap" onclick={() => (limit += PAGE)}>
          Mostra altri ({results.length - shown.length})
        </button>
      {/if}

      <button type="button" class="create tap" onclick={() => openForm(null)}>Non c'è? Crea esercizio personalizzato</button>
    </div>
  {:else}
    <CustomExerciseForm
      exercise={view.exercise}
      suggestedName={query.trim()}
      suggestedKind={cardioOnly ? 'cardio' : 'strength'}
      {busy}
      errors={formErrors}
      deleteWarning={warning}
      onsave={save}
      oncancel={() => backToList()}
      onaskdelete={askDelete}
      onconfirmdelete={confirmDelete}
    />
  {/if}
</BottomSheet>

<style>
  .lib {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 62dvh;
  }

  .search-bar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-bottom: var(--space-1);
    background: var(--surface);
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
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .chips::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex-shrink: 0;
    min-height: var(--touch);
    padding: 0 14px;
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

  .count {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .result {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 8px 8px 8px 12px;
    background: var(--bg);
  }

  .r-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .r-name {
    font-size: 15px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .r-meta {
    font-size: 12px;
    color: var(--muted);
  }

  .r-edit,
  .r-add {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
  }

  .r-edit {
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--muted);
  }

  .r-add {
    background: var(--training);
    border: 0;
    color: var(--on-tone);
  }

  .r-add.in {
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--training);
    cursor: default;
  }

  .none {
    padding: var(--space-4) 0;
    color: var(--muted);
    font-size: 14px;
  }

  .more,
  .create {
    min-height: 48px;
    background: transparent;
    font-size: 14px;
  }

  .more {
    border: 1px solid var(--line);
    color: var(--text);
  }

  .create {
    border: 1px dashed var(--line-strong);
    color: var(--text-2);
  }
</style>
