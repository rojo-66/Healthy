<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import Tabs from '../../lib/components/Tabs.svelte';
  import { deliverFile } from '../../lib/data/deliver-file';
  import { ValidationError } from '../../lib/data/errors';
  import { liveState } from '../../lib/data/live.svelte';
  import { getDietLogDay } from '../../lib/data/repo/diet-log';
  import { activateDietPlan, listDietPlans, saveImportedPlan, type DietSaveMode } from '../../lib/data/repo/diet-plans';
  import { getShoppingWeek } from '../../lib/data/repo/shopping';
  import type { DietLogDay } from '../../lib/data/schemas/diet-log';
  import type { DietPlan } from '../../lib/data/schemas/diet-plans';
  import type { ShoppingWeek } from '../../lib/data/schemas/shopping';
  import { headerDate, isoWeekday, minutesOfDay, toIsoDate, weekStartOf } from '../../lib/diet/calc/calendar';
  import { readDietImport, type DietImport } from '../../lib/diet/import/detect';
  import { atPercent } from '../../lib/diet/format';
  import { parseRecipeParam } from '../../lib/diet/links';
  import { route } from '../../lib/router.svelte';
  import { planExportFile } from '../../lib/diet/import/export';
  import { previewDietImport, type DietImportPreview } from '../../lib/diet/import/preview';
  import Screen from '../Screen.svelte';
  import ImportSheet from './ImportSheet.svelte';
  import PlanSheet from './PlanSheet.svelte';
  import PlanTab from './PlanTab.svelte';
  import RecipesTab from './RecipesTab.svelte';
  import ShoppingTab from './ShoppingTab.svelte';

  interface Props {
    now: Date;
  }

  let { now }: Props = $props();

  // Fissati alla creazione: a mezzanotte la schermata si ricrea (vedi Diet.svelte).
  const start = untrack(() => now);
  const todayIso = toIsoDate(start);
  const todayWeekday = isoWeekday(start);
  const weekStart = weekStartOf(start);
  const nowMinutes = $derived(minutesOfDay(now));

  const plans = liveState<DietPlan[]>(listDietPlans, []);
  const log = liveState<DietLogDay | undefined>(() => getDietLogDay(todayIso), undefined);
  const shop = liveState<ShoppingWeek | undefined>(() => getShoppingWeek(weekStart), undefined);

  const active = $derived(plans.current.find((p) => p.active));
  const archived = $derived(plans.current.filter((p) => !p.active && p.archived));

  type TabId = 'piano' | 'spesa' | 'ricette';
  const TABS: readonly { id: TabId; label: string }[] = [
    { id: 'piano', label: 'Piano' },
    { id: 'spesa', label: 'Spesa' },
    { id: 'ricette', label: 'Ricette' },
  ];
  // `#/dieta?ricetta=N` (link "Ricetta N" della Home) apre direttamente la ricetta nella tab Ricette.
  const linkedRecipe = parseRecipeParam(untrack(() => route.query['ricetta']));
  let tab = $state<TabId>(linkedRecipe === null ? 'piano' : 'ricette');
  let selected = $state(todayWeekday);
  let openRecipe = $state<number | null>(linkedRecipe);
  let focusToken = $state(linkedRecipe === null ? 0 : 1);

  function showRecipe(n: number) {
    openRecipe = n;
    focusToken++;
    tab = 'ricette';
  }

  // --- Stato di import/export ---
  let busy = $state(false);
  let planOpen = $state(false);
  let planStatus = $state('');
  let status = $state('');
  let errorTitle = $state('');
  let errors = $state<readonly string[]>([]);
  /** Piano appena importato ma incompleto: proposta "Completa il piano". */
  let incompleteAfterImport = $state<number | null>(null);
  let pendingExport = $state<File | null>(null);

  let incoming = $state.raw<{ imp: DietImport; preview: DietImportPreview } | null>(null);
  let importOpen = $state(false);
  let importTitle = $state('');
  let importErrors = $state<readonly string[]>([]);

  let fileInput: HTMLInputElement;

  function resetMessages() {
    status = '';
    errorTitle = '';
    errors = [];
    planStatus = '';
  }

  async function run(task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try {
      await task();
    } finally {
      busy = false;
    }
  }

  function chooseFile() {
    resetMessages();
    fileInput.click();
  }

  function onPageFile() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) openFile(file);
  }

  function openFile(file: File) {
    resetMessages();
    void run(async () => {
      const result = await readDietImport(file);
      planOpen = false;
      if (!result.ok) {
        errorTitle = 'File non valido: nessun dato modificato';
        errors = result.errors;
        return;
      }
      incoming = { imp: result.value, preview: previewDietImport(result.value, plans.current) };
      importTitle = result.value.file.title;
      importErrors = [];
      importOpen = true;
    });
  }

  function saveImport(mode: DietSaveMode) {
    const pending = incoming;
    if (!pending) return;
    void run(async () => {
      try {
        const title = pending.imp.origin === 'mydiet' ? importTitle.trim() : pending.imp.file.title;
        const saved = await saveImportedPlan({ ...pending.imp.file, title }, pending.imp.origin, mode);
        importOpen = false;
        status = `Piano «${saved.title}» importato: ora è quello attivo.`;
        incompleteAfterImport = pending.preview.completeness.percent < 100 ? pending.preview.completeness.percent : null;
        tab = 'piano';
        selected = todayWeekday;
      } catch (error) {
        importErrors = error instanceof ValidationError ? error.errors : ['Salvataggio non riuscito: nessun dato modificato.'];
      }
    });
  }

  async function deliver(file: File) {
    const result = await deliverFile(file);
    if (result === 'needs-gesture') {
      pendingExport = file;
      planStatus = 'File pronto: tocca «Condividi il file».';
      status = planStatus;
      return;
    }
    pendingExport = null;
    planStatus =
      result === 'cancelled' ? 'Esportazione annullata.' : result === 'shared' ? 'Piano condiviso.' : `File scaricato: ${file.name}`;
  }

  function exportPlan() {
    const plan = active;
    if (!plan) return;
    resetMessages();
    void run(async () => {
      try {
        await deliver(planExportFile(plan));
      } catch (error) {
        planStatus = error instanceof ValidationError ? error.errors.join(' ') : 'Esportazione non riuscita.';
      }
    });
  }

  function restore(plan: DietPlan) {
    resetMessages();
    void run(async () => {
      try {
        await activateDietPlan(plan.id);
        planStatus = `Piano «${plan.title}» ripristinato: ora è quello attivo.`;
        status = planStatus;
      } catch (error) {
        planStatus = error instanceof ValidationError ? error.errors.join(' ') : 'Ripristino non riuscito.';
      }
    });
  }

  function edit() {
    planOpen = false;
    location.hash = '#/dieta/completa';
  }
</script>

<Screen nav="dieta">
  <div class="page tone-food">
    <header class="top">
      <span class="date mono-label">{headerDate(now)}</span>
      <div class="title-row">
        <h1 class="graffiti">Dieta</h1>
        {#if active}
          <button
            type="button"
            class="plan-btn tap"
            aria-haspopup="dialog"
            aria-expanded={planOpen}
            aria-label="Piano {active.title}: importa, esporta, modifica, condividi"
            onclick={() => (resetMessages(), (planOpen = true))}
          >
            <Icon name="file" size={16} />
            <span>{active.title}</span>
          </button>
        {/if}
      </div>
    </header>

    <input
      bind:this={fileInput}
      class="visually-hidden"
      type="file"
      accept=".json,application/json"
      tabindex="-1"
      aria-hidden="true"
      data-testid="diet-input"
      onchange={onPageFile}
    />

    <p class="status" role="status" aria-live="polite">{status}</p>
    {#if pendingExport}
      <Button tone="food" variant="secondary" block onclick={() => pendingExport && void run(() => deliver(pendingExport!))}>
        {#snippet icon()}<Icon name="share" size={18} />{/snippet}
        Condividi il file
      </Button>
    {/if}
    {#if errors.length > 0}
      <NoteBox title={errorTitle} mark="!">
        <ul class="errors">
          {#each errors as message, i (i)}<li>{message}</li>{/each}
        </ul>
      </NoteBox>
    {/if}
    {#if incompleteAfterImport !== null && active}
      <NoteBox title="Piano da completare" mark="!">
        <p class="note-text">
          Il piano è completo {atPercent(incompleteAfterImport)}: mancano dati per calcolare kcal e target.
        </p>
        <Button tone="food" href="#/dieta/completa">Completa il piano</Button>
      </NoteBox>
    {/if}

    {#if !plans.loaded}
      <p class="loading">Carico il piano…</p>
    {:else if !active}
      <Card tone="food" label="Nessun piano">
        <h2 class="empty-title graffiti">Nessun piano</h2>
        <p class="empty-text">
          Importa il piano del tuo nutrizionista: va bene il file JSON esportato da MyDiet oppure un piano di Healthy. Resta
          sul telefono e funziona anche senza rete.
        </p>
        <Button tone="food" size="lg" block disabled={busy} onclick={chooseFile}>Importa il tuo piano</Button>
        {#if archived.length > 0}
          <p class="empty-text">Oppure ripristina un piano precedente:</p>
          {#each archived as old (old.id)}
            <Button variant="secondary" block disabled={busy} onclick={() => restore(old)}>Ripristina «{old.title}»</Button>
          {/each}
        {/if}
      </Card>
    {:else}
      <Tabs tabs={TABS} bind:selected={tab} label="Sezioni" tone="food">
        {#snippet panel(id)}
          {#if id === 'piano'}
            <PlanTab
              plan={active}
              {todayIso}
              {todayWeekday}
              {nowMinutes}
              log={log.current}
              bind:selected
              onrecipe={showRecipe}
            />
          {:else if id === 'spesa'}
            <ShoppingTab payload={active.payload} {weekStart} checked={shop.current?.checked ?? {}} />
          {:else}
            <RecipesTab
              recipes={active.payload.recipes}
              bind:open={openRecipe}
              {focusToken}
              fromMyDiet={active.origin === 'mydiet'}
            />
          {/if}
        {/snippet}
      </Tabs>
    {/if}
  </div>
</Screen>

{#if active}
  <PlanSheet
    bind:open={planOpen}
    plan={active}
    {archived}
    {busy}
    status={planStatus}
    onfile={openFile}
    onexport={exportPlan}
    onedit={edit}
    onshare={() => (planStatus = 'Link e QR arrivano con la condivisione (in un prossimo aggiornamento). Per ora usa «Esporta».')}
    onrestore={restore}
  />
{/if}

<ImportSheet
  bind:open={importOpen}
  preview={incoming?.preview ?? null}
  bind:title={importTitle}
  {busy}
  errors={importErrors}
  onsave={saveImport}
  onclose={() => (incoming = null)}
/>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: calc(var(--space-6) + var(--safe-top)) calc(var(--space-5) + var(--safe-right)) var(--space-8)
      calc(var(--space-5) + var(--safe-left));
    background-image: radial-gradient(circle at 88% 4%, var(--tone-tint), transparent 38%);
  }

  .top {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .date {
    font-size: 12px;
    white-space: nowrap;
  }

  .title-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h1 {
    font-size: 54px;
    line-height: 1;
    color: var(--tone);
    text-shadow: 0 0 18px var(--tone-glow);
    transform: rotate(-3deg);
    transform-origin: left bottom;
  }

  .plan-btn {
    min-width: 0;
    min-height: var(--touch);
    margin-bottom: var(--space-1);
    padding: 0 var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
  }

  .plan-btn span {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status:empty {
    display: none;
  }

  .status {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .errors {
    margin: 0;
    padding-left: 1.2em;
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .note-text {
    margin: 0;
    font-size: 14px;
  }

  .loading {
    color: var(--muted);
  }

  .empty-title {
    font-size: 30px;
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-2);
  }
</style>
