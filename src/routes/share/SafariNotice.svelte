<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { copyText } from '../../lib/share/web-share';

  /**
   * Link toccato in Messaggi/WhatsApp: su iPhone si apre in Safari, che ha una memoria separata dall'app
   * installata (SPEC § 10). Qui si mostra l'anteprima ma non si salva: si copia il link e lo si incolla nell'app.
   */
  interface Props {
    url: string;
    payload: string;
  }

  let { url, payload }: Props = $props();

  let status = $state('');
  let manual = $state('');

  async function copy(text: string, what: string) {
    manual = '';
    if (await copyText(text)) {
      status = `${what} copiato. Ora apri Healthy dalla schermata Home e incollalo in Importa.`;
    } else {
      manual = text;
      status = 'Non riesco a copiare da solo: tieni premuto il testo qui sotto e scegli «Copia».';
    }
  }
</script>

<section class="safari" aria-labelledby="safari-h" data-testid="safari-notice">
  <NoteBox title="Sei in Safari, non nell'app" mark="!">
    <p id="safari-h" class="text">
      Safari e l'app installata hanno memorie separate: salvato qui, finirebbe nel posto sbagliato. Copia il link, apri
      Healthy dalla schermata Home, tocca <b>Importa</b> e poi <b>Incolla</b>.
    </p>
    <p class="text small">
      Non hai ancora l'app? In Safari tocca Condividi › Aggiungi alla schermata Home, aprila e incolla il link.
    </p>
  </NoteBox>
  <div class="pair">
    <Button variant="secondary" tone="progress" onclick={() => void copy(payload, 'Codice')}>Copia codice</Button>
    <Button tone="progress" onclick={() => void copy(url, 'Link')}>Copia link</Button>
  </div>
  {#if manual}
    <label class="manual">
      <span class="visually-hidden">Testo da copiare</span>
      <textarea readonly rows="3" onfocus={(e) => e.currentTarget.select()}>{manual}</textarea>
    </label>
  {/if}
  <p class="status" role="status" aria-live="polite">{status}</p>
</section>

<style>
  .safari {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .small {
    font-size: 13px;
    color: var(--text-2);
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
  }

  .status:empty {
    display: none;
  }

  .status {
    margin: 0;
    font-size: 14px;
  }
</style>
