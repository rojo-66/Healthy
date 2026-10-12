<script lang="ts" module>
  import type { BackupPreview } from '../../lib/data/backup';
  import type { Backup } from '../../lib/data/schemas/backup';

  export interface IncomingBackup {
    backup: Backup;
    preview: BackupPreview;
    /** `demo` = dati di prova della pagina tecnica. */
    source: 'file' | 'demo';
  }
</script>

<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { TABLE_LABELS, TABLE_NAMES } from '../../lib/data/schemas';

  // Anteprima di un backup prima di sostituire i dati (Profilo e pagina tecnica): conteggi e conferma.

  interface Props {
    open: boolean;
    incoming: IncomingBackup | null;
    /** Elementi attualmente nel database. */
    total: number;
    onconfirm: (backup: Backup) => void;
    onclose?: () => void;
  }

  let { open = $bindable(false), incoming, total, onconfirm, onclose }: Props = $props();

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function confirm() {
    // Il contenuto resta visibile mentre il pannello scende: chi apre azzera `incoming` in `onclose`.
    const pending = incoming;
    open = false;
    if (pending) onconfirm(pending.backup);
  }
</script>

<BottomSheet bind:open title="Sostituire i dati?" tone="progress" {onclose}>
  {#if incoming}
    <p class="text">
      {#if incoming.source === 'file'}
        Backup del <strong>{formatDateTime(incoming.preview.createdAt)}</strong>, {incoming.preview.total} elementi:
      {:else}
        Dati di prova, {incoming.preview.total} elementi:
      {/if}
    </p>
    <dl class="counts" data-testid="preview">
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
      <Button variant="ghost" onclick={() => (open = false)}>Annulla</Button>
      <Button tone="progress" onclick={confirm}>Sostituisci i dati</Button>
    </div>
  {/if}
</BottomSheet>

<style>
  .text {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .counts {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--bg);
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
    font-weight: 700;
  }

  .grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
</style>
