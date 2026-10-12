<script lang="ts">
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { MAX_TEXT } from '../../lib/data/limits';
  import { fromIsoDate } from '../../lib/diet/calc/calendar';
  import type { DietImportPreview } from '../../lib/diet/import/preview';

  // Anteprima di un piano ricevuto (ex ImportSheet di M3): tutto come testo.
  interface Props {
    preview: DietImportPreview;
    /** Titolo modificabile (solo per i file MyDiet, che non ne hanno uno). */
    title: string;
  }

  let { preview, title = $bindable() }: Props = $props();

  function longDate(iso: string): string {
    return fromIsoDate(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  }
</script>

<article class="diet tone-food" aria-label="Anteprima del piano">
  <div class="what">
    <span class="mono-label kind">Piano alimentare</span>
    {#if preview.origin === 'mydiet'}
      <label class="field">
        <span class="mono-label">Titolo</span>
        <input type="text" bind:value={title} maxlength={MAX_TEXT.name} autocomplete="off" />
      </label>
    {:else}
      <h2 class="graffiti">{preview.title}</h2>
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
  <p class="meta">Completo al {preview.completeness.percent}%</p>

  {#if preview.warnings.length > 0}
    <NoteBox title="Da completare dopo l'import" mark="!">
      <ul class="list">
        {#each preview.warnings as w, i (i)}<li>{w}</li>{/each}
      </ul>
    </NoteBox>
  {/if}
</article>

<style>
  .diet,
  .what {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .what {
    gap: var(--space-2);
  }

  .kind {
    color: var(--tone);
  }

  h2 {
    font-size: 28px;
    color: var(--tone);
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
    background: var(--surface);
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
</style>
