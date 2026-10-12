<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { MAX_TEXT } from '../../lib/data/limits';

  // Nota scritta da una persona (lettura del nutrizionista, condizioni per la misura): solo testo, mai HTML.
  interface Props {
    open: boolean;
    title: string;
    label: string;
    placeholder: string;
    initial: string;
    /** Data facoltativa accanto al testo (prossima bioimpedenza); `undefined` = niente data. */
    initialDate?: string | null;
    dateLabel?: string;
    onsave: (text: string, date: string | null) => Promise<readonly string[]>;
  }

  let { open = $bindable(false), title, label, placeholder, initial, initialDate, dateLabel = 'Data', onsave }: Props = $props();

  const id = $props.id();
  let text = $state('');
  let date = $state('');
  let errors = $state<readonly string[]>([]);
  let busy = $state(false);

  let wasOpen = false;
  $effect(() => {
    if (open && !wasOpen) {
      text = initial;
      date = initialDate ?? '';
      errors = [];
    }
    wasOpen = open;
  });

  async function save() {
    if (busy) return;
    busy = true;
    try {
      errors = await onsave(text, initialDate === undefined ? null : date || null);
      if (errors.length === 0) open = false;
    } finally {
      busy = false;
    }
  }
</script>

<BottomSheet bind:open {title} tone="tip">
  <div class="form">
    <label for="{id}-text">{label}</label>
    <textarea id="{id}-text" rows="6" maxlength={MAX_TEXT.note} {placeholder} bind:value={text}></textarea>
    {#if initialDate !== undefined}
      <label for="{id}-date">{dateLabel}</label>
      <div class="date-row">
        <input id="{id}-date" type="date" bind:value={date} />
        {#if date}<Button variant="ghost" size="sm" onclick={() => (date = '')}>Togli data</Button>{/if}
      </div>
    {/if}
    {#if errors.length > 0}
      <NoteBox title="Non salvato" mark="!">
        {#each errors as e, i (i)}<p class="err">{e}</p>{/each}
      </NoteBox>
    {/if}
    <div class="actions">
      <Button variant="ghost" onclick={() => (open = false)}>Annulla</Button>
      <Button tone="tip" disabled={busy} onclick={save}>Salva</Button>
    </div>
  </div>
</BottomSheet>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  label {
    font-size: 13px;
    color: var(--text-2);
  }

  textarea,
  input {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-size: 16px;
    line-height: 1.45;
  }

  textarea {
    resize: vertical;
  }

  input {
    min-height: var(--touch);
    padding: 0 var(--space-3);
  }

  textarea:focus,
  input:focus {
    outline: 2px solid var(--tip);
    outline-offset: 0;
  }

  .date-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .err {
    margin: 0;
    font-size: 14px;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
