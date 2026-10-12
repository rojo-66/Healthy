<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import {
    backupToFile,
    BACKUP_STALE_DAYS,
    buildBackup,
    isBackupStale,
    markBackupDone,
    previewBackup,
    readBackupFile,
    restoreBackup,
  } from '../../lib/data/backup';
  import { deliverFile } from '../../lib/data/deliver-file';
  import { ValidationError } from '../../lib/data/errors';
  import { liveState } from '../../lib/data/live.svelte';
  import { countAll } from '../../lib/data/repo/maintenance';
  import { getSetting } from '../../lib/data/repo/settings';
  import { TABLE_NAMES } from '../../lib/data/schemas';
  import type { Backup } from '../../lib/data/schemas/backup';
  import RestoreConfirmSheet, { type IncomingBackup } from './RestoreConfirmSheet.svelte';

  // Backup e ripristino (SPEC § 8.5): esporta, importa con anteprima e conferma, promemoria dopo 14 giorni.
  interface Props {
    now: Date;
    /** Dopo un'operazione che cambia lo spazio usato (es. per aggiornare i dati sulla memoria). */
    onchange?: () => void;
  }

  let { now, onchange }: Props = $props();

  const lastBackupAt = liveState(() => getSetting('lastBackupAt'), null);
  const counts = liveState(countAll, null);
  const total = $derived(counts.current ? TABLE_NAMES.reduce((sum, name) => sum + counts.current![name], 0) : 0);

  let busy = $state(false);
  let status = $state('');
  let errorTitle = $state('');
  let errors = $state<readonly string[]>([]);
  /** File pronto ma non condiviso: Safari ha "consumato" il tocco durante l'attesa. */
  let pendingFile = $state<File | null>(null);
  let incoming = $state.raw<IncomingBackup | null>(null);
  let confirmOpen = $state(false);
  let fileInput: HTMLInputElement;

  const stale = $derived(lastBackupAt.loaded && isBackupStale(lastBackupAt.current, now));
  const lastText = $derived(
    lastBackupAt.current === null
      ? 'mai'
      : new Date(lastBackupAt.current).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }),
  );

  function reset() {
    status = '';
    errorTitle = '';
    errors = [];
  }

  async function run(task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    reset();
    try {
      await task();
    } finally {
      busy = false;
      onchange?.();
    }
  }

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
        const at = new Date();
        await deliver(backupToFile(await buildBackup(at), at));
      } catch (error) {
        errorTitle = 'Esportazione non riuscita';
        errors = error instanceof ValidationError ? error.errors : ['Impossibile creare il backup.'];
      }
    });
  }

  function sharePending() {
    const file = pendingFile;
    if (file) void run(() => deliver(file));
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
      incoming = { backup: result.value, preview: previewBackup(result.value), source: 'file' };
      confirmOpen = true;
    });
  }

  function restore(backup: Backup) {
    void run(async () => {
      try {
        await restoreBackup(backup);
        status = `Dati sostituiti: ${previewBackup(backup).total} elementi.`;
      } catch (error) {
        errorTitle = 'Ripristino non riuscito';
        errors = error instanceof ValidationError ? error.errors : ['I dati attuali non sono stati modificati.'];
      }
    });
  }
</script>

<div class="panel">
  {#if stale}
    <div data-testid="backup-stale">
      <NoteBox title="Promemoria backup" mark="!">
        <p class="note-text">
          {lastBackupAt.current === null
            ? 'Non hai ancora fatto un backup.'
            : `L'ultimo backup ha più di ${BACKUP_STALE_DAYS} giorni.`}
          I dati sono solo su questo telefono: esporta un backup e salvalo in File o mandalo a te.
        </p>
      </NoteBox>
    </div>
  {/if}

  <dl class="facts">
    <div><dt>Ultimo backup</dt><dd data-testid="last-backup">{lastText}</dd></div>
  </dl>

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
  <p class="status" role="status" aria-live="polite" data-testid="backup-status">{status}</p>
  {#if errors.length > 0}
    <NoteBox title={errorTitle} mark="!">
      <ul class="errors">
        {#each errors as message, i (i)}
          <li>{message}</li>
        {/each}
      </ul>
    </NoteBox>
  {/if}
</div>

<RestoreConfirmSheet bind:open={confirmOpen} {incoming} {total} onconfirm={restore} onclose={() => (incoming = null)} />

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .note-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .facts {
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
</style>
