<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { deliverFile, downloadFile } from '../../lib/data/deliver-file';
  import { formatInt } from '../../lib/diet/format';
  import { sizeLabel } from '../../lib/share/availability';
  import type { PreparedShare } from '../../lib/share/prepare';
  import { copyText, shareLink } from '../../lib/share/web-share';
  import QrCode from './QrCode.svelte';

  // Pannello Condividi unico (SPEC § 8.4): scheda (riga di Allena, "Salva e invia") e dieta (pannello piano).
  interface Props {
    open: boolean;
    share: PreparedShare;
    tone: 'training' | 'food';
    /** Riga sopra le azioni (es. "«Gambe» salvata · v3 → v4."). */
    intro?: string;
    /** Diete: avviso sui dati personali, da confermare prima di vedere le azioni. */
    personalWarning?: boolean;
  }

  let { open = $bindable(false), share, tone, intro = '', personalWarning = false }: Props = $props();

  let confirmed = $state(false);
  let status = $state('');
  /** Testo da copiare a mano quando gli appunti non sono disponibili. */
  let manual = $state('');
  /** Safari ha "consumato" il tocco: il file resta pronto per un nuovo tocco. */
  let retryFile = $state(false);
  let showQr = $state(false);

  function reset() {
    confirmed = false;
    status = '';
    manual = '';
    retryFile = false;
    showQr = false;
  }

  async function copy(text: string, what: string) {
    manual = '';
    if (await copyText(text)) {
      status = `${what} copiato: incollalo in un messaggio.`;
    } else {
      manual = text;
      status = 'Non riesco a copiare da solo: tieni premuto il testo qui sotto e scegli «Copia».';
    }
  }

  async function sendLink() {
    manual = '';
    const result = await shareLink({ url: share.url, title: share.name });
    if (result === 'shared') status = 'Link condiviso.';
    else if (result === 'cancelled') status = '';
    else if (result === 'needs-gesture') status = 'Tocca di nuovo «Condividi link».';
    else await copy(share.url, 'Link');
  }

  async function sendFile() {
    manual = '';
    const result = await deliverFile(share.file);
    retryFile = result === 'needs-gesture';
    status =
      result === 'shared'
        ? 'File condiviso.'
        : result === 'cancelled'
          ? ''
          : result === 'needs-gesture'
            ? 'File pronto: tocca di nuovo «Condividi file».'
            : `File scaricato: ${share.file.name}`;
  }

  function saveFile() {
    downloadFile(share.file);
    status = `File scaricato: ${share.file.name}`;
  }

  const what = $derived(share.kind === 'diet' ? 'il piano' : 'la scheda');
</script>

<BottomSheet bind:open title="Condividi «{share.name}»" {tone} onclose={reset}>
  {#if intro}<p class="intro">{intro}</p>{/if}

  {#if personalWarning && !confirmed}
    <NoteBox
      title="Prima di condividere"
      mark="!"
      text="Questo piano può contenere target personali (calorie e macro pensati per te) e i tuoi integratori. Mandalo solo a chi vuoi tu."
    />
    <div class="pair">
      <Button variant="ghost" onclick={() => (open = false)}>Annulla</Button>
      <Button {tone} onclick={() => (confirmed = true)}>Continua</Button>
    </div>
  {:else}
    <p class="facts mono" data-testid="share-facts">
      v{share.version} · link {formatInt(share.availability.chars)} caratteri · file {sizeLabel(share.file.size)}
    </p>

    <section class="method" aria-labelledby="share-link-h">
      <h3 id="share-link-h" class="mono-label">Link</h3>
      {#if share.availability.link.ok}
        <p class="hint">Chi lo riceve lo incolla nell'app: Allena › Importa › Incolla.</p>
        <div class="pair">
          <Button variant="secondary" {tone} onclick={() => void copy(share.url, 'Link')}>Copia link</Button>
          <Button {tone} onclick={() => void sendLink()}>Condividi link</Button>
        </div>
      {:else}
        <p class="reason" data-testid="share-link-reason">{share.availability.link.reason}</p>
      {/if}
    </section>

    <section class="method" aria-labelledby="share-qr-h">
      <h3 id="share-qr-h" class="mono-label">QR</h3>
      {#if share.availability.qr.ok}
        {#if showQr}
          <QrCode text={share.url} label="QR del link di «{share.name}»" />
          <p class="hint">
            Alza la luminosità e tieni il telefono fermo. Chi lo riceve lo legge dall'app: Importa › Scansiona QR (la
            fotocamera di iPhone lo aprirebbe in Safari).
          </p>
        {:else}
          <Button variant="secondary" {tone} block onclick={() => (showQr = true)}>Mostra il QR</Button>
        {/if}
      {:else}
        <p class="reason" data-testid="share-qr-reason">{share.availability.qr.reason}</p>
      {/if}
    </section>

    <section class="method" aria-labelledby="share-file-h">
      <h3 id="share-file-h" class="mono-label">File</h3>
      <p class="hint">Funziona sempre. Chi lo riceve lo apre dall'app: Importa › Scegli file.</p>
      <div class="pair">
        <Button variant="secondary" {tone} onclick={saveFile}>Scarica</Button>
        <Button {tone} onclick={() => void sendFile()}>{retryFile ? 'Condividi file (di nuovo)' : 'Condividi file'}</Button>
      </div>
    </section>

    {#if manual}
      <label class="manual">
        <span class="visually-hidden">Testo da copiare</span>
        <textarea readonly rows="3" data-testid="share-manual" onfocus={(e) => e.currentTarget.select()}>{manual}</textarea>
      </label>
    {/if}
    <p class="status" role="status" aria-live="polite">{status}</p>
    <p class="privacy">Solo {what}: niente sessioni, progressi, misure o note personali. Nessun server: il contenuto viaggia nel link o nel file.</p>
  {/if}
</BottomSheet>

<style>
  .intro {
    margin: 0;
    font-size: 15px;
    color: var(--text);
  }

  .facts {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .method {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg);
    border: 1px solid var(--line);
  }

  h3 {
    margin: 0;
    font-size: 12px;
    color: var(--tone);
  }

  .hint,
  .reason,
  .privacy {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-2);
  }

  .reason {
    color: var(--tip);
  }

  .privacy {
    font-size: 12px;
    color: var(--muted);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .manual textarea {
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-2) var(--space-3);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 0;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 16px;
    resize: none;
    overflow-wrap: anywhere;
  }

  .status:empty {
    display: none;
  }

  .status {
    margin: 0;
    font-size: 14px;
    color: var(--text);
  }
</style>
