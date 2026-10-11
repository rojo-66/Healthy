<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { MAX_TEXT } from '../../lib/data/limits';
  import type { DietSaveMode } from '../../lib/data/repo/diet-plans';
  import { fromIsoDate } from '../../lib/diet/calc/calendar';
  import type { DietImportPreview } from '../../lib/diet/import/preview';

  interface Props {
    open: boolean;
    preview: DietImportPreview | null;
    /** Titolo modificabile (solo per i file MyDiet, che non ne hanno uno). */
    title: string;
    busy: boolean;
    errors: readonly string[];
    onsave: (mode: DietSaveMode) => void;
    onclose: () => void;
  }

  let { open = $bindable(), preview, title = $bindable(), busy, errors, onsave, onclose }: Props = $props();

  function longDate(iso: string): string {
    return fromIsoDate(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const conflict = $derived(preview?.conflict ?? { kind: 'none' as const });
</script>

<BottomSheet bind:open title="Importa piano" tone="food" {onclose}>
  {#if preview}
    <div class="what">
      {#if preview.origin === 'mydiet'}
        <label class="field">
          <span class="mono-label">Titolo</span>
          <input type="text" bind:value={title} maxlength={MAX_TEXT.name} autocomplete="off" />
        </label>
      {:else}
        <h3 class="graffiti">{preview.title}</h3>
      {/if}
      <p class="meta">
        {preview.origin === 'mydiet' ? 'File di MyDiet' : preview.author || 'Piano di Healthy'} · v{preview.version}
        {#if preview.validFrom}· valido dal {longDate(preview.validFrom)}{/if}
      </p>
    </div>

    <dl class="counts" data-testid="import-preview">
      <div><dt>Giorni</dt><dd class="mono">{preview.days}</dd></div>
      <div><dt>Pasti</dt><dd class="mono">{preview.meals}</dd></div>
      <div><dt>Prodotti</dt><dd class="mono">{preview.products}</dd></div>
      <div><dt>Ricette</dt><dd class="mono">{preview.recipes}</dd></div>
    </dl>

    {#if preview.warnings.length > 0}
      <NoteBox title="Da completare dopo l'import" mark="!">
        <ul class="list">
          {#each preview.warnings as w, i (i)}<li>{w}</li>{/each}
        </ul>
      </NoteBox>
    {/if}

    {#if conflict.kind === 'newer'}
      <NoteBox
        title="Piano già presente"
        mark="!"
        text={`Hai già «${conflict.existing.title}» (v${conflict.existing.version}): il file è la v${preview.version}. Puoi sostituirlo o salvarlo come copia.`}
      />
    {:else if conflict.kind === 'same-or-older'}
      <NoteBox
        title="Piano già presente"
        mark="!"
        text={conflict.existing.version === preview.version
          ? `Hai già «${conflict.existing.title}» nella stessa versione (v${preview.version}). Puoi salvarlo come copia.`
          : `Hai già «${conflict.existing.title}» in una versione più recente (v${conflict.existing.version}). Puoi salvare questo file come copia.`}
      />
    {/if}

    {#if errors.length > 0}
      <NoteBox title="Non importato" mark="!">
        <ul class="list">
          {#each errors as e, i (i)}<li>{e}</li>{/each}
        </ul>
      </NoteBox>
    {/if}

    <div class="buttons" class:three={conflict.kind === 'newer'}>
      <Button variant="ghost" disabled={busy} onclick={() => (open = false)}>Annulla</Button>
      {#if conflict.kind === 'none'}
        <Button tone="food" disabled={busy || title.trim() === ''} onclick={() => onsave('new')}>Importa</Button>
      {:else}
        <Button variant="secondary" tone="food" disabled={busy || title.trim() === ''} onclick={() => onsave('copy')}
          >Salva come copia</Button
        >
        {#if conflict.kind === 'newer'}
          <Button tone="food" disabled={busy || title.trim() === ''} onclick={() => onsave('replace')}>Sostituisci</Button>
        {/if}
      {/if}
    </div>
    <p class="hint">Il nuovo piano diventa quello attivo; il precedente resta nell'archivio.</p>
  {/if}
</BottomSheet>

<style>
  .what {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h3 {
    font-size: 24px;
    overflow-wrap: anywhere;
  }

  .meta {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field input {
    min-height: var(--touch);
    padding: 0 var(--space-3);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 0;
    color: var(--text);
    font-size: 16px;
  }

  .field input:focus-visible {
    outline: 2px solid var(--tone);
    outline-offset: 0;
  }

  .counts {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg);
  }

  .counts div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .counts dt {
    font-size: 12px;
    color: var(--muted);
  }

  .counts dd {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  .list {
    margin: 0;
    padding-left: 1.2em;
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .buttons.three {
    grid-template-columns: 1fr 1.3fr 1.2fr;
  }

  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
