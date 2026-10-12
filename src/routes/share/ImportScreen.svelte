<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import type { Result } from '../../lib/data/errors';
  import { ValidationError } from '../../lib/data/errors';
  import { listDietPlans, saveImportedPlan, type DietSaveMode } from '../../lib/data/repo/diet-plans';
  import { importWorkout, workoutsRepo } from '../../lib/data/repo/workouts';
  import type { WorkoutFile } from '../../lib/data/schemas/workout-file';
  import type { DietImport } from '../../lib/diet/import/detect';
  import { previewDietImport, type DietImportPreview } from '../../lib/diet/import/preview';
  import { EMPTY_TEMPLATE_MESSAGE } from '../../lib/diet/template/template';
  import { isStandalone } from '../../lib/pwa/standalone';
  import { routeHref } from '../../lib/routes';
  import { appBaseUrl, IMPORT_PREFIX } from '../../lib/share/codec';
  import { decideDietImport, type DietImportDecision } from '../../lib/share/import/diet';
  import { readSharedFile, readSharedPayload, readSharedText, type SharedContent } from '../../lib/share/import/detect';
  import { pendingImport, takePendingImport } from '../../lib/share/import/pending.svelte';
  import { decideWorkoutImport, type WorkoutImportDecision, type WorkoutImportMode } from '../../lib/share/import/workout';
  import ClaudeGuideSheet from '../diet/ClaudeGuideSheet.svelte';
  import ActionBar from '../train/ActionBar.svelte';
  import DietImportPreviewView from './DietImportPreview.svelte';
  import QrScanner from './QrScanner.svelte';
  import SafariNotice from './SafariNotice.svelte';
  import VersionNotice from './VersionNotice.svelte';
  import WorkoutImportPreview from './WorkoutImportPreview.svelte';

  /**
   * Importa (SPEC § 8.4): un solo flusso per schede e diete, tre ingressi (incolla, QR, file),
   * sempre un'anteprima e una conferma esplicita prima di salvare.
   */
  interface Props {
    /** Da dove si arriva: `allena`, `dieta` (pulsanti Importa) o `link` (`#import=…` nell'indirizzo). */
    from: string;
  }

  let { from }: Props = $props();
  const origin = untrack(() => from);

  type Loaded =
    | { kind: 'workout'; file: WorkoutFile; decision: WorkoutImportDecision }
    | { kind: 'diet'; imp: DietImport; preview: DietImportPreview; decision: DietImportDecision };

  let loaded = $state.raw<Loaded | null>(null);
  let errors = $state<readonly string[]>([]);
  let saveErrors = $state<readonly string[]>([]);
  let busy = $state(false);
  let pasted = $state('');
  let scanning = $state(false);
  let dietTitle = $state('');
  /** Codice arrivato da un link nell'indirizzo (per "Copia link" in Safari). */
  let linkPayload = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement>();
  /** Mini-guida "Prepara il piano con Claude" (dal messaggio sul modello vuoto). */
  let guideOpen = $state(false);
  const emptyTemplate = $derived(errors.includes(EMPTY_TEMPLATE_MESSAGE));

  const standalone = isStandalone(window);
  /** Link aperto nel browser (non nell'app installata): anteprima sì, salvataggio no. */
  const browserLink = $derived(linkPayload !== null && !standalone);
  const tone = $derived(loaded?.kind === 'diet' ? 'food' : 'training');

  async function show(result: Result<SharedContent>) {
    saveErrors = [];
    if (!result.ok) {
      loaded = null;
      errors = result.errors;
      return;
    }
    errors = [];
    const content = result.value;
    if (content.kind === 'workout') {
      const existing = await workoutsRepo.get(content.file.id);
      loaded = { kind: 'workout', file: content.file, decision: decideWorkoutImport(content.file, existing) };
    } else {
      const plans = await listDietPlans();
      dietTitle = content.imp.file.title;
      loaded = {
        kind: 'diet',
        imp: content.imp,
        preview: previewDietImport(content.imp, plans),
        decision: decideDietImport(content.imp, plans),
      };
    }
  }

  function fromLink(payload: string) {
    linkPayload = payload;
    pasted = '';
    void show(readSharedPayload(payload));
  }

  // Link arrivato all'avvio, o con l'app già aperta su Importa (`hashchange`: la schermata non si ricrea).
  $effect(() => {
    void pendingImport.token;
    untrack(() => {
      const payload = takePendingImport();
      if (payload !== null) fromLink(payload);
    });
  });

  function readPaste() {
    linkPayload = null;
    void show(readSharedText(pasted));
  }

  /** QR letto con la fotocamera dell'app: stesso percorso del testo incollato. */
  function fromQr(text: string) {
    linkPayload = null;
    void show(readSharedText(text));
  }

  function chooseFile() {
    fileInput?.click();
  }

  async function onFile() {
    const file = fileInput?.files?.[0];
    if (fileInput) fileInput.value = '';
    if (!file) return;
    linkPayload = null;
    await show(await readSharedFile(file));
  }

  function reset() {
    loaded = null;
    errors = [];
    saveErrors = [];
    linkPayload = null;
  }

  function back() {
    location.hash = origin === 'dieta' ? '#/dieta' : origin === 'allena' ? '#/allena' : '#/';
  }

  const LABELS: Readonly<Record<WorkoutImportMode, string>> = {
    new: 'Importa',
    replace: 'Sostituisci',
    copy: 'Salva come copia',
  };

  async function save(mode: WorkoutImportMode) {
    const current = loaded;
    if (!current || busy || browserLink) return;
    busy = true;
    saveErrors = [];
    try {
      if (current.kind === 'workout') {
        const out = await importWorkout(current.file, mode);
        location.replace(routeHref('/allena', { importata: out.workout.id }));
      } else {
        const title = current.imp.origin === 'mydiet' ? dietTitle.trim() : current.imp.file.title;
        await saveImportedPlan({ ...current.imp.file, title }, current.imp.origin, mode as DietSaveMode);
        location.replace(routeHref('/dieta', { importato: '1' }));
      }
    } catch (error) {
      saveErrors = error instanceof ValidationError ? error.errors : ['Salvataggio non riuscito: nessun dato modificato.'];
    } finally {
      busy = false;
    }
  }

  const actions = $derived(loaded ? loaded.decision.actions : []);
  const primary = $derived(loaded ? loaded.decision.defaultAction : 'new');
  const secondary = $derived(actions.find((a) => a !== primary) ?? null);
  const titleMissing = $derived(loaded?.kind === 'diet' && loaded.imp.origin === 'mydiet' && dietTitle.trim() === '');
</script>

<div class="screen tone-{tone}">
  <header class="head tone-progress">
    <button type="button" class="back tap" aria-label="Indietro" onclick={back}>
      <Icon name="back" stroke={1.6} />
    </button>
    <h1 class="graffiti">Importa</h1>
  </header>

  <main class="body scroll">
    {#if !loaded}
      <p class="lead">Ricevi una scheda o un piano alimentare: incolla il link, scansiona il QR o scegli il file. Prima di salvare vedi sempre un'anteprima.</p>

      <div class="entry">
        <label class="mono-label" for="imp-paste-text">Incolla link o codice</label>
        <textarea
          id="imp-paste-text"
          rows="3"
          bind:value={pasted}
          placeholder="https://…/#import=…"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        ></textarea>
        <Button tone="progress" block disabled={pasted.trim() === ''} onclick={readPaste}>Leggi</Button>
      </div>

      <div class="entry">
        <Button variant="secondary" tone="progress" block onclick={() => (scanning = true)}>
          {#snippet icon()}<Icon name="qr" size={18} />{/snippet}
          Scansiona QR
        </Button>
        <Button variant="secondary" tone="progress" block onclick={chooseFile}>
          {#snippet icon()}<Icon name="file" size={18} />{/snippet}
          Scegli file .json
        </Button>
        <input
          bind:this={fileInput}
          class="visually-hidden"
          type="file"
          accept=".json,application/json"
          tabindex="-1"
          aria-hidden="true"
          data-testid="import-file"
          onchange={() => void onFile()}
        />
      </div>
    {:else}
      <button type="button" class="other tap" onclick={reset}>← Importa un'altra cosa</button>
    {/if}

    {#if errors.length > 0}
      <NoteBox title="Non importato" mark="!">
        <ul class="list" data-testid="import-errors">
          {#each errors as e, i (i)}<li>{e}</li>{/each}
        </ul>
        {#if emptyTemplate}
          <Button tone="food" variant="secondary" block onclick={() => (guideOpen = true)}>Apri la guida</Button>
        {/if}
      </NoteBox>
    {/if}

    {#if loaded}
      {#if browserLink && linkPayload !== null}
        <SafariNotice url="{appBaseUrl()}{IMPORT_PREFIX}{linkPayload}" payload={linkPayload} />
      {:else if loaded.kind === 'workout'}
        <VersionNotice
          status={loaded.decision.status}
          noun="scheda"
          existingName={loaded.decision.existing?.name ?? ''}
          existingVersion={loaded.decision.existing?.version ?? 0}
          incomingVersion={loaded.file.version}
          receivedVersion={loaded.decision.existing?.received?.version ?? null}
          localEdits={loaded.decision.localEdits}
        />
      {:else}
        <VersionNotice
          status={loaded.decision.status}
          noun="piano"
          existingName={loaded.decision.existing?.title ?? ''}
          existingVersion={loaded.decision.existing?.version ?? 0}
          incomingVersion={loaded.imp.file.version}
        />
      {/if}

      {#if loaded.kind === 'workout'}
        <WorkoutImportPreview file={loaded.file} />
      {:else}
        <DietImportPreviewView preview={loaded.preview} bind:title={dietTitle} />
        {#if !browserLink}<p class="hint">Il nuovo piano diventa quello attivo; il precedente resta nell'archivio.</p>{/if}
      {/if}

      {#if saveErrors.length > 0}
        <NoteBox title="Non salvato" mark="!">
          <ul class="list">
            {#each saveErrors as e, i (i)}<li>{e}</li>{/each}
          </ul>
        </NoteBox>
      {/if}
    {/if}
  </main>

  <QrScanner bind:open={scanning} onresult={fromQr} />
  <ClaudeGuideSheet bind:open={guideOpen} onimport={() => (guideOpen = false)} />

  {#if loaded && !browserLink}
    <ActionBar {tone} even={secondary !== null}>
      {#if secondary}
        <Button variant="secondary" {tone} disabled={busy || titleMissing} onclick={() => void save(secondary)}>{LABELS[secondary]}</Button>
      {:else}
        <Button variant="secondary" tone="neutral" disabled={busy} onclick={reset}>Annulla</Button>
      {/if}
      <Button {tone} size="lg" disabled={busy || titleMissing} onclick={() => void save(primary)}>{LABELS[primary]}</Button>
    </ActionBar>
  {/if}
</div>

<style>
  .screen {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100dvh;
    overflow: hidden;
    background-image: radial-gradient(circle at 90% 8%, var(--tone-tint), transparent 40%);
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: calc(var(--safe-top) + var(--space-2)) calc(var(--space-5) + var(--safe-right)) var(--space-3)
      calc(var(--space-2) + var(--safe-left));
    background: rgba(18, 20, 26, 0.96);
    border-bottom: 1px solid var(--line);
  }

  .back {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
  }

  h1 {
    font-size: 30px;
    line-height: 1;
    color: var(--tone);
    text-shadow: 0 0 14px var(--tone-glow);
    transform: rotate(-2deg);
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4) calc(var(--space-5) + var(--safe-right)) calc(140px + var(--safe-bottom))
      calc(var(--space-5) + var(--safe-left));
  }

  .lead,
  .hint {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-2);
  }

  .hint {
    font-size: 12px;
    color: var(--muted);
  }

  .entry {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-3);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: 0;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 16px;
    resize: none;
  }

  textarea:focus-visible {
    outline: 2px solid var(--progress);
    outline-offset: 0;
  }

  .other {
    align-self: flex-start;
    min-height: var(--touch);
    padding: 0 var(--space-2);
    border: 0;
    background: transparent;
    color: var(--progress);
    font-size: 14px;
  }

  .list {
    margin: 0;
    padding-left: 1.2em;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
</style>
