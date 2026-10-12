<script lang="ts">
  import BottomSheet from '../lib/components/BottomSheet.svelte';
  import Button from '../lib/components/Button.svelte';
  import Card from '../lib/components/Card.svelte';
  import Icon from '../lib/components/Icon.svelte';
  import NoteBox from '../lib/components/NoteBox.svelte';
  import { parseBackup, previewBackup, restoreBackup } from '../lib/data/backup';
  import { ValidationError } from '../lib/data/errors';
  import { liveState } from '../lib/data/live.svelte';
  import { clearAll, countAll, type TableCounts } from '../lib/data/repo/maintenance';
  import { TABLE_LABELS, TABLE_NAMES } from '../lib/data/schemas';
  import type { Backup } from '../lib/data/schemas/backup';
  import { routeHref } from '../lib/routes';
  import RestoreConfirmSheet, { type IncomingBackup } from './profile/RestoreConfirmSheet.svelte';
  // Dati finti: un'unica fonte con i test (tests/fixtures), finiscono solo in questo chunk.
  import demoBackup from '../../tests/fixtures/backup-valid.json';

  // Strumenti di sviluppo (raggiungibili solo dall'indirizzo e da #/showcase). Backup, ripristino,
  // persistenza e spazio usato sono nel Profilo (M7): qui restano conteggi, dati di prova e "Svuota tutto".

  const EMPTY = Object.fromEntries(TABLE_NAMES.map((name) => [name, 0])) as TableCounts;
  const counts = liveState(countAll, EMPTY);
  const total = $derived(TABLE_NAMES.reduce((sum, name) => sum + counts.current[name], 0));

  let busy = $state(false);
  let status = $state('');
  let errorTitle = $state('');
  let errors = $state<readonly string[]>([]);
  let incoming = $state.raw<IncomingBackup | null>(null);
  let sheetImport = $state(false);
  let sheetClear = $state(false);

  async function run(task: () => Promise<void>, failTitle: string, failText: string) {
    if (busy) return;
    busy = true;
    status = '';
    errorTitle = '';
    errors = [];
    try {
      await task();
    } catch (error) {
      errorTitle = failTitle;
      errors = error instanceof ValidationError ? error.errors : [failText];
    } finally {
      busy = false;
    }
  }

  function replaceWith(backup: Backup) {
    void run(
      async () => {
        await restoreBackup(backup);
        status = `Dati sostituiti: ${previewBackup(backup).total} elementi.`;
      },
      'Ripristino non riuscito',
      'I dati attuali non sono stati modificati.',
    );
  }

  function loadDemo() {
    const result = parseBackup(demoBackup);
    if (!result.ok) {
      errorTitle = 'Dati di prova non validi';
      errors = result.errors;
      return;
    }
    if (total === 0) return replaceWith(result.value);
    incoming = { backup: result.value, preview: previewBackup(result.value), source: 'demo' };
    sheetImport = true;
  }

  function confirmClear() {
    sheetClear = false;
    void run(
      async () => {
        await clearAll();
        status = 'Dati svuotati.';
      },
      'Svuotamento non riuscito',
      'I dati non sono stati modificati.',
    );
  }
</script>

<div class="page">
  <header class="top">
    <a class="back tap" href="#/showcase" aria-label="Torna ai componenti"><Icon name="back" stroke={1.6} /></a>
    <div>
      <h1 class="graffiti">Dati</h1>
      <p class="sub">Strumenti di sviluppo · database «healthy-app»</p>
    </div>
  </header>

  <section class="block" aria-labelledby="s-counts">
    <h2 id="s-counts" class="mono-label">Contenuto</h2>
    <Card tone="progress" label="Righe per tabella">
      <dl class="counts" data-testid="counts">
        {#each TABLE_NAMES as name (name)}
          <div class="count">
            <dt>{TABLE_LABELS[name]}</dt>
            <dd class="mono" data-table={name}>{counts.current[name]}</dd>
          </div>
        {/each}
        <div class="count total">
          <dt>Totale</dt>
          <dd class="mono" data-table="total">{total}</dd>
        </div>
      </dl>
    </Card>
  </section>

  <section class="block" aria-labelledby="s-test">
    <h2 id="s-test" class="mono-label">Prova</h2>
    <Button variant="secondary" block disabled={busy} onclick={loadDemo}>Carica dati di prova</Button>
    <Button variant="secondary" block disabled={busy || total === 0} onclick={() => (sheetClear = true)}>
      Svuota tutto
    </Button>
    <p class="status" role="status" aria-live="polite">{status}</p>
    {#if errors.length > 0}
      <NoteBox title={errorTitle} mark="!">
        <ul class="errors">
          {#each errors as message, i (i)}
            <li>{message}</li>
          {/each}
        </ul>
      </NoteBox>
    {/if}
    <p class="hint">
      Backup, ripristino e memoria del telefono sono nel <a href={routeHref('/profilo')}>Profilo</a>.
    </p>
  </section>
</div>

<RestoreConfirmSheet bind:open={sheetImport} {incoming} {total} onconfirm={replaceWith} onclose={() => (incoming = null)} />

<BottomSheet bind:open={sheetClear} title="Svuotare tutto?" tone="progress">
  <p class="panel-text">
    Vengono cancellati tutti i dati di Healthy su questo telefono ({total} elementi). I dati di MyDiet non vengono
    toccati. Fai prima un backup se ti servono.
  </p>
  <div class="grid2">
    <Button variant="ghost" onclick={() => (sheetClear = false)}>Annulla</Button>
    <Button tone="progress" onclick={confirmClear}>Svuota</Button>
  </div>
</BottomSheet>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: calc(var(--space-4) + var(--safe-top)) calc(var(--space-4) + var(--safe-right))
      calc(var(--space-8) + var(--safe-bottom)) calc(var(--space-4) + var(--safe-left));
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .back {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--touch);
    height: var(--touch);
    color: var(--text);
  }

  .top h1 {
    font-size: 34px;
    color: var(--progress);
  }

  .sub {
    margin: var(--space-1) 0 0;
    font-size: 13px;
    color: var(--muted);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .block > h2 {
    margin: 0;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--line);
    font-size: 12px;
    color: var(--text-2);
  }

  .counts {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-4);
  }

  .count {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    font-size: 14px;
  }

  .count dt {
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count dd {
    margin: 0;
    color: var(--text);
    font-weight: 700;
  }

  .count.total {
    grid-column: 1 / -1;
    padding-top: var(--space-2);
    border-top: 1px solid var(--line);
  }

  .count.total dd {
    color: var(--progress);
  }

  .status {
    min-height: 1.45em;
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

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .hint a {
    display: inline-block;
    min-width: var(--touch);
    min-height: var(--touch);
    line-height: var(--touch);
    text-align: center;
  }

  .panel-text {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
</style>
