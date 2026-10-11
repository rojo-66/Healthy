<script lang="ts">
  import { onMount } from 'svelte';
  import BottomSheet from '../lib/components/BottomSheet.svelte';
  import Button from '../lib/components/Button.svelte';
  import Card from '../lib/components/Card.svelte';
  import Icon from '../lib/components/Icon.svelte';
  import NoteBox from '../lib/components/NoteBox.svelte';
  import {
    backupToFile,
    buildBackup,
    isBackupStale,
    markBackupDone,
    parseBackup,
    previewBackup,
    readBackupFile,
    restoreBackup,
    type BackupPreview,
  } from '../lib/data/backup';
  import { deliverFile } from '../lib/data/deliver-file';
  import { ValidationError } from '../lib/data/errors';
  import { liveState } from '../lib/data/live.svelte';
  import { clearAll, countAll, type TableCounts } from '../lib/data/repo/maintenance';
  import { getSetting } from '../lib/data/repo/settings';
  import { TABLE_LABELS, TABLE_NAMES } from '../lib/data/schemas';
  import type { Backup } from '../lib/data/schemas/backup';
  import { formatBytes, getStorageStatus, type StorageStatus } from '../lib/data/storage';
  // Dati finti: un'unica fonte con i test (tests/fixtures), finiscono solo in questo chunk.
  import demoBackup from '../../tests/fixtures/backup-valid.json';

  // Pagina tecnica (M2): prova database, backup e ripristino sull'iPhone. Sarà rimossa o riusata nel Profilo (M7).

  const EMPTY = Object.fromEntries(TABLE_NAMES.map((name) => [name, 0])) as TableCounts;
  const counts = liveState(countAll, EMPTY);
  const lastBackupAt = liveState(() => getSetting('lastBackupAt'), null);
  const total = $derived(TABLE_NAMES.reduce((sum, name) => sum + counts.current[name], 0));

  let storage = $state<StorageStatus | null>(null);
  let busy = $state(false);
  let status = $state('');
  let errorTitle = $state('');
  let errors = $state<readonly string[]>([]);

  /** File pronto ma non condiviso: Safari ha "consumato" il tocco durante l'attesa. */
  let pendingFile = $state<File | null>(null);

  /** Backup letto e valido, in attesa di conferma. */
  let incoming = $state.raw<{ backup: Backup; preview: BackupPreview; source: 'file' | 'demo' } | null>(null);
  let sheetImport = $state(false);
  let sheetClear = $state(false);

  let fileInput: HTMLInputElement;

  onMount(() => {
    void refreshStorage();
  });

  async function refreshStorage() {
    storage = await getStorageStatus();
  }

  function reset() {
    status = '';
    errorTitle = '';
    errors = [];
  }

  function showError(title: string, error: unknown, fallback: string) {
    errorTitle = title;
    errors = error instanceof ValidationError ? error.errors : [fallback];
  }

  /** Esegue un'operazione bloccando i pulsanti. */
  async function run(task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    reset();
    try {
      await task();
    } finally {
      busy = false;
      void refreshStorage();
    }
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  }

  // Esporta

  async function deliver(file: File) {
    const result = await deliverFile(file);
    if (result === 'needs-gesture') {
      pendingFile = file;
      status = 'Backup pronto: tocca «Condividi il backup».';
      return;
    }
    pendingFile = null;
    if (result === 'cancelled') {
      status = 'Condivisione annullata: il backup non è stato salvato.';
      return;
    }
    await markBackupDone();
    status = result === 'shared' ? 'Backup condiviso.' : `Backup scaricato: ${file.name}`;
  }

  function exportBackup() {
    return run(async () => {
      try {
        const now = new Date();
        await deliver(backupToFile(await buildBackup(now), now));
      } catch (error) {
        showError('Esportazione non riuscita', error, 'Impossibile creare il backup.');
      }
    });
  }

  function sharePending() {
    const file = pendingFile;
    if (file) void run(() => deliver(file));
  }

  // Importa

  function askConfirm(backup: Backup, source: 'file' | 'demo') {
    incoming = { backup, preview: previewBackup(backup), source };
    sheetImport = true;
  }

  function chooseFile() {
    reset();
    fileInput.click();
  }

  function onFileChosen() {
    const file = fileInput.files?.[0];
    // Svuota la scelta: lo stesso file si può scegliere di nuovo.
    fileInput.value = '';
    if (!file) return;
    void run(async () => {
      const result = await readBackupFile(file);
      if (!result.ok) {
        errorTitle = 'Backup non valido: nessun dato modificato';
        errors = result.errors;
        return;
      }
      askConfirm(result.value, 'file');
    });
  }

  function loadDemo() {
    reset();
    const result = parseBackup(demoBackup);
    if (!result.ok) {
      errorTitle = 'Dati di prova non validi';
      errors = result.errors;
      return;
    }
    if (total === 0) void replaceWith(result.value);
    else askConfirm(result.value, 'demo');
  }

  function replaceWith(backup: Backup) {
    return run(async () => {
      try {
        await restoreBackup(backup);
        status = `Dati sostituiti: ${previewBackup(backup).total} elementi.`;
      } catch (error) {
        showError('Ripristino non riuscito', error, 'I dati attuali non sono stati modificati.');
      }
    });
  }

  function confirmImport() {
    // `incoming` si azzera in `onclose`, a pannello chiuso: il contenuto resta visibile mentre scende.
    const pending = incoming;
    sheetImport = false;
    if (pending) void replaceWith(pending.backup);
  }

  // Svuota

  function confirmClear() {
    sheetClear = false;
    void run(async () => {
      try {
        await clearAll();
        status = 'Dati svuotati.';
      } catch (error) {
        showError('Svuotamento non riuscito', error, 'I dati non sono stati modificati.');
      }
    });
  }

  const persistedText = $derived(
    storage === null
      ? '…'
      : !storage.supported || storage.persisted === null
        ? 'non disponibile'
        : storage.persisted
          ? 'attiva'
          : 'non attiva',
  );

  const usageText = $derived.by(() => {
    if (storage === null) return '…';
    if (storage.usageBytes === null) return 'non disponibile';
    const used = formatBytes(storage.usageBytes);
    return storage.quotaBytes === null ? used : `${used} di ${formatBytes(storage.quotaBytes)}`;
  });

  const backupText = $derived(
    lastBackupAt.current === null ? 'mai' : formatDateTime(lastBackupAt.current),
  );
  const backupStale = $derived(lastBackupAt.loaded && isBackupStale(lastBackupAt.current, new Date()));
</script>

<div class="page">
  <header class="top">
    <a class="back tap" href="#/showcase" aria-label="Torna ai componenti"><Icon name="back" stroke={1.6} /></a>
    <div>
      <h1 class="graffiti">Dati</h1>
      <p class="sub">Pagina tecnica · database «healthy-app»</p>
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

  <section class="block" aria-labelledby="s-actions">
    <h2 id="s-actions" class="mono-label">Backup</h2>
    <Button tone="progress" block disabled={busy} onclick={exportBackup}>Esporta backup</Button>
    {#if pendingFile}
      <Button tone="progress" variant="secondary" block disabled={busy} onclick={sharePending}>
        {#snippet icon()}<Icon name="share" size={18} />{/snippet}
        Condividi il backup
      </Button>
    {/if}
    <Button tone="progress" variant="secondary" block disabled={busy} onclick={chooseFile}>Importa backup</Button>
    <input
      bind:this={fileInput}
      class="visually-hidden"
      type="file"
      accept=".json,application/json"
      tabindex="-1"
      aria-hidden="true"
      data-testid="backup-input"
      onchange={onFileChosen}
    />
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
  </section>

  <section class="block" aria-labelledby="s-test">
    <h2 id="s-test" class="mono-label">Prova</h2>
    <Button variant="secondary" block disabled={busy} onclick={loadDemo}>Carica dati di prova</Button>
    <Button variant="secondary" block disabled={busy || total === 0} onclick={() => (sheetClear = true)}>
      Svuota tutto
    </Button>
  </section>

  <section class="block" aria-labelledby="s-storage">
    <h2 id="s-storage" class="mono-label">Memoria del telefono</h2>
    <dl class="facts">
      <div><dt>Persistenza</dt><dd>{persistedText}</dd></div>
      <div><dt>Spazio usato</dt><dd class="mono">{usageText}</dd></div>
      <div>
        <dt>Ultimo backup</dt>
        <dd>{backupText}{#if backupStale}<span class="stale"> · da fare</span>{/if}</dd>
      </div>
    </dl>
    <p class="hint">
      Su iPhone Safari e l'app installata hanno memorie separate: questi numeri valgono solo per dove è aperta
      la pagina.
    </p>
  </section>
</div>

<BottomSheet bind:open={sheetImport} title="Sostituire i dati?" tone="progress" onclose={() => (incoming = null)}>
  {#if incoming}
    <p class="panel-text">
      {#if incoming.source === 'file'}
        Backup del <strong>{formatDateTime(incoming.preview.createdAt)}</strong>, {incoming.preview.total} elementi:
      {:else}
        Dati di prova, {incoming.preview.total} elementi:
      {/if}
    </p>
    <dl class="counts compact" data-testid="preview">
      {#each TABLE_NAMES as name (name)}
        <div class="count">
          <dt>{TABLE_LABELS[name]}</dt>
          <dd class="mono">{incoming.preview.counts[name]}</dd>
        </div>
      {/each}
    </dl>
    <NoteBox
      title="Attenzione"
      mark="!"
      text={`I dati attuali (${total} elementi) verranno sostituiti. Se qualcosa va storto restano come sono.`}
    />
    <div class="grid2">
      <Button variant="ghost" onclick={() => (sheetImport = false)}>Annulla</Button>
      <Button tone="progress" onclick={confirmImport}>Sostituisci i dati</Button>
    </div>
  {/if}
</BottomSheet>

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

  .counts.compact {
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
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

  .errors li + li {
    margin-top: var(--space-1);
  }

  .facts {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
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

  .stale {
    color: var(--tip);
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
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
