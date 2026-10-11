<script lang="ts">
  import Icon from '../../../lib/components/Icon.svelte';
  import { titleFontSize } from '../../../lib/components/title-fit';
  import type { WorkoutTotals } from '../../../lib/workouts/calc/duration';

  interface Props {
    name: string;
    /** "v3 → v4", "NUOVA · v1", "COPIA · v1". */
    badge: string;
    totals: WorkoutTotals;
    error?: string;
    onname: (name: string) => void;
    onback: () => void;
  }

  let { name, badge, totals, error, onname, onback }: Props = $props();

  const PLACEHOLDER = 'Nome della scheda';
  const MAX_PX = 28;
  // Una riga, mai a capo: più è lungo il nome, più il carattere si rimpicciolisce (28 → 16 px).
  let width = $state(0);
  const fontSize = $derived(Math.min(MAX_PX, titleFontSize(name || PLACEHOLDER, width || 230)));
</script>

<header class="head tone-training">
  <div class="row">
    <button type="button" class="back tap" aria-label="Torna alle schede" onclick={onback}>
      <Icon name="back" stroke={1.6} />
    </button>
    <div class="name-wrap" bind:clientWidth={width}>
      <label class="visually-hidden" for="workout-name">Nome della scheda</label>
      <input
        id="workout-name"
        type="text"
        maxlength="120"
        autocomplete="off"
        enterkeyhint="done"
        placeholder={PLACEHOLDER}
        value={name}
        style:font-size="{fontSize}px"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? 'workout-name-err' : undefined}
        oninput={(e) => onname(e.currentTarget.value)}
      />
    </div>
    <span class="badge mono" data-testid="version-badge">{badge}</span>
  </div>
  {#if error}<p class="err" id="workout-name-err" data-error>Nome: {error}</p>{/if}
  <div class="counters mono" data-testid="editor-counters">
    <span><b>{totals.exercises}</b> esercizi</span>
    <span><b>{totals.sets}</b> serie</span>
    <span>~<b>{totals.totalMin}</b> min</span>
  </div>
</header>

<style>
  .head {
    flex: none;
    position: relative;
    z-index: var(--z-banner);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: calc(var(--safe-top) + var(--space-2)) calc(var(--space-5) + var(--safe-right)) var(--space-3)
      calc(var(--space-2) + var(--safe-left));
    background: rgba(18, 20, 26, 0.96);
    border-bottom: 1px solid var(--line);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .back {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
  }

  .name-wrap {
    flex: 1;
    min-width: 0;
  }

  input {
    width: 100%;
    height: var(--touch);
    padding: 0 8px;
    background: transparent;
    border: 0;
    border-bottom: 1px dashed var(--line-strong);
    color: var(--tone);
    font-family: var(--font-graffiti);
    text-shadow: 0 0 14px var(--tone-glow);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  input::placeholder {
    color: var(--muted);
    text-shadow: none;
  }

  input:focus {
    outline: 1px solid var(--tone);
    outline-offset: 0;
  }

  input[aria-invalid='true'] {
    border-bottom-color: var(--tip);
  }

  .badge {
    flex-shrink: 0;
    margin-left: var(--space-2);
    padding: 2px 6px;
    font-size: 11px;
    color: var(--tip);
    border: 1px solid var(--tip-edge);
    white-space: nowrap;
  }

  .counters {
    display: flex;
    gap: 14px;
    padding-left: 10px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }

  .counters b {
    color: var(--text);
  }

  .err {
    margin: 0;
    padding-left: 52px;
    font-size: 13px;
    color: var(--tip);
  }
</style>
