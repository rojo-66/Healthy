<script lang="ts">
  import { edgeSwipe } from '../lib/sessions/edge-swipe';
  import { onMount, untrack } from 'svelte';
  import Button from '../lib/components/Button.svelte';
  import NoteBox from '../lib/components/NoteBox.svelte';
  import TopBanner from '../lib/components/TopBanner.svelte';
  import { clearWorkoutDraft, getWorkoutAuthor, getWorkoutDraft } from '../lib/data/repo/settings';
  import { workoutsRepo } from '../lib/data/repo/workouts';
  import type { SavedDraft, WorkoutAuthor, WorkoutDraft } from '../lib/data/schemas/workout-draft';
  import type { Workout } from '../lib/data/schemas/workouts';
  import { draftFingerprint, draftFromWorkout, emptyDraft } from '../lib/workouts/draft';
  import { syncLibrary } from '../lib/workouts/library/sync';
  import ConfirmSheet from './train/ConfirmSheet.svelte';
  import EditorScreen from './train/editor/EditorScreen.svelte';

  // Crea (`#/allena/editor`) o modifica (`?id=…`) una scheda. `bozza=1`: riprende la bozza senza chiedere.
  interface Props {
    query: Readonly<Record<string, string>>;
  }

  let { query }: Props = $props();
  const id = untrack(() => query['id'] ?? null);
  const autoResume = untrack(() => query['bozza'] === '1');

  interface Ready {
    initial: WorkoutDraft;
    baseline: string;
    original: Workout | undefined;
    author: WorkoutAuthor;
    resumed: boolean;
  }

  type Phase =
    | { kind: 'loading' }
    | { kind: 'notfound' }
    | { kind: 'ask'; saved: SavedDraft; fresh: Omit<Ready, 'initial' | 'resumed'> & { draft: WorkoutDraft } }
    | ({ kind: 'ready' } & Ready);

  let phase = $state.raw<Phase>({ kind: 'loading' });
  let askOpen = $state(false);

  onMount(() => {
    void syncLibrary().catch(() => null);
    void load();
  });

  async function load() {
    const [author, saved, original] = await Promise.all([
      getWorkoutAuthor(),
      getWorkoutDraft(),
      id ? workoutsRepo.get(id) : Promise.resolve(undefined),
    ]);
    // La bozza (una sola) vale per questa scheda, oppure per una scheda nuova se non c'è id.
    const matching = saved && (id ? saved.draft.workoutId === id : saved.draft.baseVersion === null) ? saved : null;
    if (id && !original && !matching) {
      phase = { kind: 'notfound' };
      return;
    }
    const draft = original ? draftFromWorkout(original) : emptyDraft(author);
    const baseline = draftFingerprint(draft);
    if (!matching || draftFingerprint(matching.draft) === baseline) {
      phase = { kind: 'ready', initial: draft, baseline, original, author, resumed: false };
      return;
    }
    if (autoResume) {
      phase = { kind: 'ready', initial: matching.draft, baseline, original, author, resumed: true };
      return;
    }
    phase = { kind: 'ask', saved: matching, fresh: { draft, baseline, original, author } };
    askOpen = true;
  }

  function resume() {
    if (phase.kind !== 'ask') return;
    const { saved, fresh } = phase;
    phase = { kind: 'ready', initial: saved.draft, baseline: fresh.baseline, original: fresh.original, author: fresh.author, resumed: true };
  }

  function discard() {
    if (phase.kind !== 'ask') return;
    const { fresh } = phase;
    void clearWorkoutDraft().catch(() => null);
    phase = { kind: 'ready', initial: fresh.draft, baseline: fresh.baseline, original: fresh.original, author: fresh.author, resumed: false };
  }

  function savedAtText(iso: string): string {
    const d = new Date(iso);
    const day = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return `${day} alle ${time}`;
  }
</script>

{#if phase.kind === 'ready'}
  <EditorScreen initial={phase.initial} baseline={phase.baseline} original={phase.original} author={phase.author} resumed={phase.resumed} />
{:else}
  <div class="screen" use:edgeSwipe={() => (location.hash = '#/allena')}>
    <TopBanner title={id ? 'Modifica scheda' : 'Nuova scheda'} tone="training" backHref="#/allena" backLabel="Torna alle schede" />
    <div class="body">
      {#if phase.kind === 'notfound'}
        <NoteBox title="Scheda non trovata" mark="!" text="Forse è stata eliminata. Torna all'elenco delle schede." />
        <Button tone="training" href="#/allena">Torna alle schede</Button>
      {:else}
        <p class="hint">Carico la scheda…</p>
      {/if}
    </div>
  </div>
{/if}

{#if phase.kind === 'ask'}
  <ConfirmSheet
    bind:open={askOpen}
    title="Riprendere la bozza?"
    text="Hai una bozza non salvata di «{phase.saved.draft.name || 'scheda senza nome'}» del {savedAtText(phase.saved.savedAt)}."
    actions={[
      { label: 'Riprendi la bozza', kind: 'primary', run: resume },
      { label: 'Scarta la bozza', kind: 'danger', run: discard },
    ]}
    oncancel={resume}
  />
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    height: var(--app-h);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4) calc(var(--space-5) + var(--safe-right)) var(--space-8) calc(var(--space-5) + var(--safe-left));
  }

  .hint {
    color: var(--muted);
  }
</style>
