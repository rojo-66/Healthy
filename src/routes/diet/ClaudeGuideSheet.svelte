<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import { deliverFile } from '../../lib/data/deliver-file';
  import { CLAUDE_PROMPT, templateFile } from '../../lib/diet/template/template';
  import { copyText } from '../../lib/share/web-share';

  // "Prepara il piano con Claude" (§ 8.2): modello da scaricare, messaggio da copiare, import del risultato.
  // L'app non manda niente a nessuno: tutto passa dalle mani dell'utente.
  interface Props {
    open: boolean;
    /** Passo 3: dalla Dieta porta a Importa; da Importa chiude soltanto il foglio. */
    onimport: () => void;
  }

  let { open = $bindable(false), onimport }: Props = $props();

  let status = $state('');
  /** Testo da copiare a mano quando gli appunti non sono disponibili. */
  let manual = $state(false);
  /** Safari ha "consumato" il tocco: serve un nuovo tocco per il foglio di condivisione. */
  let retry = $state(false);

  function reset() {
    status = '';
    manual = false;
    retry = false;
  }

  async function download() {
    // Il file si crea subito nel tocco: nessuna attesa prima della condivisione.
    const file = templateFile();
    const result = await deliverFile(file);
    retry = result === 'needs-gesture';
    status =
      result === 'shared'
        ? 'Modello condiviso: salvalo dove lo ritrovi (es. File).'
        : result === 'cancelled'
          ? ''
          : result === 'needs-gesture'
            ? 'Modello pronto: tocca di nuovo «Scarica il modello».'
            : `File scaricato: ${file.name}`;
  }

  async function copy() {
    manual = false;
    if (await copyText(CLAUDE_PROMPT)) {
      status = 'Messaggio copiato: incollalo nella chat con Claude.';
    } else {
      manual = true;
      status = 'Non riesco a copiare da solo: tieni premuto il testo qui sotto e scegli «Copia».';
    }
  }
</script>

<BottomSheet bind:open title="Prepara il piano con Claude" tone="food" onclose={reset}>
  <ol class="steps">
    <li class="step">
      <span class="num mono" aria-hidden="true">1</span>
      <div class="body">
        <Button tone="food" block onclick={() => void download()}>
          {retry ? 'Scarica il modello (di nuovo)' : 'Scarica il modello'}
        </Button>
      </div>
    </li>

    <li class="step">
      <span class="num mono" aria-hidden="true">2</span>
      <div class="body">
        <p class="text">
          Apri una chat con Claude, allega la tua dieta (PDF o foto) e il modello, e invia questo messaggio:
        </p>
        {#if manual}
          <label class="manual">
            <span class="visually-hidden">Messaggio da copiare</span>
            <textarea readonly rows="5" data-testid="claude-prompt-manual" onfocus={(e) => e.currentTarget.select()}
              >{CLAUDE_PROMPT}</textarea
            >
          </label>
        {:else}
          <p class="prompt" data-testid="claude-prompt">{CLAUDE_PROMPT}</p>
        {/if}
        <Button variant="secondary" tone="food" block onclick={() => void copy()}>Copia</Button>
      </div>
    </li>

    <li class="step">
      <span class="num mono" aria-hidden="true">3</span>
      <div class="body">
        <p class="text">Scarica il file che ti restituisce e importalo qui.</p>
        <Button variant="secondary" tone="food" block onclick={onimport}>Importa il file</Button>
      </div>
    </li>
  </ol>

  <p class="status" role="status" aria-live="polite">{status}</p>
  <p class="foot">
    La dieta la invii tu a Claude: l'app non manda niente da sola. Controlla sempre i numeri con il piano originale.
  </p>
</BottomSheet>

<style>
  .steps {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .step {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--bg);
    border: 1px solid var(--line);
  }

  .num {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--tone-edge);
    color: var(--tone);
    font-size: 14px;
    font-weight: 700;
  }

  .body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .text {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text);
  }

  .prompt,
  .manual textarea {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--surface);
    border: 1px dashed var(--line-strong);
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .manual textarea {
    width: 100%;
    box-sizing: border-box;
    border-style: solid;
    border-radius: 0;
    color: var(--text);
    font-size: 16px;
    resize: none;
  }

  .status:empty {
    display: none;
  }

  .status {
    margin: 0;
    font-size: 14px;
    color: var(--text);
  }

  .foot {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted);
  }
</style>
