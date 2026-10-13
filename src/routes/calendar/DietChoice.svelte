<script lang="ts">
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { setDayChoice } from '../../lib/data/repo/calendar';
  import { ValidationError } from '../../lib/data/errors';
  import { relativeDayWord } from '../../lib/today/home';

  /**
   * Giorno con palestra e corsa (2c): quale dieta seguire. La scelta vale per quella data; senza scelta, palestra.
   * Nei giorni passati si legge soltanto.
   */
  interface Props {
    date: string;
    todayIso: string;
    /** Tipo di adesso (`gym` o `run`). */
    current: string;
  }

  let { date, todayIso, current }: Props = $props();

  const past = $derived(date < todayIso);
  const when = $derived(date === todayIso ? 'Oggi' : relativeDayWord(date, todayIso) || 'Questo giorno');
  let error = $state('');

  const OPTIONS = [
    { type: 'gym', label: 'Dieta palestra' },
    { type: 'run', label: 'Dieta corsa' },
  ] as const;

  async function choose(type: 'gym' | 'run') {
    error = '';
    try {
      await setDayChoice(date, type === 'gym' ? null : type);
    } catch (e) {
      error = e instanceof ValidationError ? e.errors.join('\n') : 'Scelta non salvata: riprova.';
    }
  }
</script>

<NoteBox title="{when} hai palestra e corsa" mark="!">
  <p class="text">
    {past ? 'Dieta seguita:' : 'Quale dieta segui? La scelta vale solo per questo giorno.'}
  </p>
  <div class="chips" role="group" aria-label="Dieta del giorno" data-testid="diet-choice">
    {#each OPTIONS as o (o.type)}
      <button
        type="button"
        class="chip tap"
        class:on={current === o.type}
        aria-pressed={current === o.type}
        disabled={past}
        onclick={() => void choose(o.type)}
      >
        {o.label}{o.type === 'gym' ? ' (predefinita)' : ''}
      </button>
    {/each}
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</NoteBox>

<style>
  .text {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
  }

  .chip.on {
    border-color: var(--tip);
    background: var(--tip);
    color: var(--bg);
  }

  .chip:disabled:not(.on) {
    opacity: 0.45;
  }

  .error {
    margin: 0;
    color: var(--tip);
    font-size: 13px;
  }
</style>
