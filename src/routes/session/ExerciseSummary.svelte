<script lang="ts">
  import Icon from '../../lib/components/Icon.svelte';
  import { drop } from '../../lib/design/transitions';
  import { setLabel, volumeLabel } from '../../lib/sessions/format';
  import type { ExerciseSummary } from '../../lib/sessions/summary';

  // Esercizio nel Riepilogo: badge serie fatte, serie migliore, volume, confronto, PR; tocco → dettaglio.
  interface Props {
    exercise: ExerciseSummary;
    open: boolean;
    ontoggle: () => void;
  }

  let { exercise: e, open, ontoggle }: Props = $props();
  const id = $props.id();
  const fraction = $derived(e.planned > 0 ? Math.min(1, e.done / e.planned) : 0);
</script>

<div class="ex" data-testid="exercise-summary">
  <button type="button" class="head tap" aria-expanded={open} aria-controls="{id}-detail" onclick={ontoggle}>
    <!-- Stesso riempimento della barra a segmenti: magenta fatto, --partial il resto. -->
    <span class="badge mono" class:partial={fraction > 0 && fraction < 1} aria-label="{e.done} serie fatte su {e.planned}">
      <span class="badge-fill bar" style:transform="translateX({(fraction - 1) * 100}%)"></span>
      <span class="badge-n">{e.done}/{e.planned}</span>
    </span>
    <span class="main">
      <span class="title">
        <span class="name">{e.name}</span>
        {#if e.pr}<span class="pr">PR</span>{/if}
      </span>
      <span class="meta mono">
        {e.best ? `top ${setLabel(e.best.kg, e.best.reps)}` : 'nessuna serie'} · {volumeLabel(e.volume)}
      </span>
    </span>
    <span class="delta mono {e.delta.kind}">{e.delta.text}</span>
    <span class="chev" class:open aria-hidden="true"><Icon name="chevronDown" size={16} /></span>
  </button>
  {#if open}
    <div class="detail" id="{id}-detail" in:drop>
      {#each e.sets as s (s.n)}
        <div class="set mono" class:skipped={!s.done}>
          <span class="n">{s.n}</span>
          <span class="text">{s.text}{s.extra ? ' · in più' : ''}{s.pr ? ' · PR' : ''}</span>
          <span class="mark" aria-hidden="true">{s.done ? '✓' : '—'}</span>
        </div>
      {/each}
      {#if e.note}
        <div class="note">
          <span class="mono-label note-head">Tua nota per il PT</span>
          <p>{e.note}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ex {
    display: flex;
    flex-direction: column;
    background: var(--surface);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 64px;
    padding: var(--space-3) 14px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
  }

  .badge {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    overflow: hidden;
    background: var(--line);
    font-weight: 700;
    font-size: 13px;
    color: var(--on-tone);
  }

  /* Parziale: testo chiaro con contorno scuro, leggibile sia sul magenta sia su --partial. */
  .badge.partial {
    background: var(--partial);
    color: var(--text);
    text-shadow:
      0 0 2px var(--bg),
      0 0 3px var(--bg);
  }

  .badge-fill {
    position: absolute;
    inset: 0;
    background: var(--training);
  }

  .badge-n {
    position: relative;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pr {
    flex: none;
    padding: 1px 6px;
    background: var(--training);
    color: var(--on-tone);
    font-family: var(--font-graffiti);
    font-size: 12px;
    transform: rotate(-4deg);
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }

  .delta {
    flex: none;
    font-weight: 700;
    font-size: 12px;
    color: var(--muted);
  }

  .delta.up {
    color: var(--progress);
  }

  .delta.warn {
    color: var(--tip);
  }

  .chev {
    flex: none;
    display: flex;
    color: var(--muted);
    transition: transform var(--dur-ind) var(--ease-out);
  }

  .chev.open {
    transform: rotate(180deg);
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 14px 14px;
  }

  .set {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    gap: var(--space-2);
    align-items: center;
    padding: 6px var(--space-2);
    background: var(--bg);
    font-size: 13px;
  }

  .set .n {
    color: var(--muted);
  }

  .set .mark {
    color: var(--training);
    font-weight: 700;
  }

  .set.skipped .text,
  .set.skipped .mark {
    color: var(--tip);
  }

  .note {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-1);
    padding: 10px var(--space-3);
    border: 1px solid var(--line-strong);
  }

  .note-head {
    font-size: 10px;
    color: var(--progress);
  }

  .note p {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
</style>
