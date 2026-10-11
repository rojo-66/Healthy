<script lang="ts">
  import CheckButton from '../../lib/components/CheckButton.svelte';
  import type { SessionSet } from '../../lib/data/schemas/sessions';
  import { setLabel } from '../../lib/sessions/format';
  import { kgInputValue, parseKg, parseReps } from '../../lib/sessions/input';
  import type { LastSet } from '../../lib/sessions/last-time';

  // Una riga della tabella serie: SET · ULTIMA VOLTA · KG · RIP · ✓.
  interface Props {
    set: SessionSet;
    last: LastSet | undefined;
    /** Serie aggiunta oltre il piano. */
    extra: boolean;
    onkg: (kg: number) => void;
    onreps: (reps: number) => void;
    ontoggle: () => void;
  }

  let { set, last, extra, onkg, onreps, ontoggle }: Props = $props();

  const n = $derived(set.setIndex + 1);
  // Mentre si scrive il campo mostra esattamente il testo digitato ("57," resta "57,").
  let kgText = $state<string | null>(null);
  let repsText = $state<string | null>(null);

  function inputKg(e: Event & { currentTarget: HTMLInputElement }) {
    kgText = e.currentTarget.value;
    const kg = parseKg(kgText);
    if (kg !== null && kg !== set.kg) onkg(kg);
  }

  function inputReps(e: Event & { currentTarget: HTMLInputElement }) {
    repsText = e.currentTarget.value;
    const reps = parseReps(repsText);
    if (reps !== null && reps !== set.reps) onreps(reps);
  }

  const selectAll = (e: FocusEvent & { currentTarget: HTMLInputElement }) => e.currentTarget.select();
</script>

<div class="row" class:done={set.done} role="row" data-testid="set-row">
  <span class="n mono" class:extra role="cell" title={extra ? 'Serie aggiunta' : undefined}>{n}{extra ? '+' : ''}</span>
  <span class="last mono" role="cell">{last?.done ? setLabel(last.kg, last.reps) : '—'}</span>
  <span role="cell" class="cell">
    <input
      class="num mono"
      type="text"
      inputmode="decimal"
      enterkeyhint="done"
      autocomplete="off"
      aria-label="Chili serie {n}"
      value={kgText ?? kgInputValue(set.kg)}
      oninput={inputKg}
      onfocus={selectAll}
      onblur={() => (kgText = null)}
    />
  </span>
  <span role="cell" class="cell">
    <input
      class="num mono"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      enterkeyhint="done"
      autocomplete="off"
      aria-label="Ripetizioni serie {n}"
      value={repsText ?? String(set.reps)}
      oninput={inputReps}
      onfocus={selectAll}
      onblur={() => (repsText = null)}
    />
  </span>
  <span role="cell" class="cell">
    <CheckButton
      checked={set.done}
      tone="training"
      label={set.done ? `Serie ${n} fatta, tocca per annullare` : `Segna serie ${n} come fatta`}
      onchange={ontoggle}
    />
  </span>
</div>

<style>
  .row {
    position: relative;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 70px 54px 44px;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-1);
  }

  /* Riga fatta: tinta magenta che compare con opacity. */
  .row::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--training-tint);
    opacity: 0;
    transition: opacity var(--dur-fade) ease;
    pointer-events: none;
  }

  .row.done::before {
    opacity: 1;
  }

  .n,
  .last,
  .cell {
    position: relative;
  }

  .n {
    font-weight: 700;
    font-size: 15px;
  }

  .n.extra {
    color: var(--training);
  }

  .last {
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .num {
    box-sizing: border-box;
    width: 100%;
    height: var(--touch);
    padding: 0 2px;
    border: 1px solid var(--line);
    border-radius: 0;
    background: var(--bg);
    color: var(--text);
    /* 16 px: sotto, Safari ingrandisce la pagina al tocco. */
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    appearance: none;
  }

  .num:focus {
    outline: 2px solid var(--training);
    outline-offset: -1px;
  }
</style>
