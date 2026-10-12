<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import { metricWithUnit, numericDate, spanText } from '../../lib/profile/format';

  interface Option {
    id: string;
    date: string;
    weightKg: number | null;
  }

  interface Props {
    /** Misure dalla più recente alla più vecchia. */
    options: readonly Option[];
    before: Option;
    after: Option;
    onpick: (side: 'before' | 'after', id: string) => void;
  }

  let { options, before, after, onpick }: Props = $props();

  let side = $state<'before' | 'after'>('after');
  let open = $state(false);
  const current = $derived(side === 'after' ? after.id : before.id);

  function choose(which: 'before' | 'after') {
    side = which;
    open = true;
  }

  function pick(id: string) {
    open = false;
    onpick(side, id);
  }
</script>

<div class="dates mono" role="group" aria-label="Date a confronto">
  <button
    type="button"
    class="date tap"
    data-testid="date-before"
    aria-label="Misura precedente: {numericDate(before.date)}. Cambia"
    onclick={() => choose('before')}>{numericDate(before.date)}</button
  >
  <span class="arrow" aria-hidden="true">→</span>
  <button
    type="button"
    class="date tap current"
    data-testid="date-after"
    aria-label="Misura attuale: {numericDate(after.date)}. Cambia"
    onclick={() => choose('after')}>{numericDate(after.date)}</button
  >
  <span class="span" data-testid="date-span">{spanText(before.date, after.date)}</span>
</div>

<BottomSheet bind:open title={side === 'after' ? 'Misura attuale' : 'Misura precedente'} tone="progress">
  <div class="list" role="radiogroup" aria-label="Date delle misure">
    {#each options as o (o.id)}
      <button type="button" role="radio" class="opt tap" aria-checked={o.id === current} onclick={() => pick(o.id)}>
        <span class="mono">{numericDate(o.date)}</span>
        <span class="weight">{o.weightKg !== null ? metricWithUnit('weight', o.weightKg) : 'senza peso'}</span>
      </button>
    {/each}
  </div>
  <p class="hint">La precedente è sempre più vecchia dell'attuale: se serve, l'altra data si sposta sulla misura vicina.</p>
</BottomSheet>

<style>
  .dates {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 13px;
  }

  .date {
    height: var(--touch);
    padding: 0 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 13px;
    color: var(--muted);
  }

  .date.current {
    border-color: var(--progress);
    color: var(--progress);
    font-weight: 700;
  }

  .arrow {
    color: var(--muted);
  }

  .span {
    margin-left: auto;
    min-width: 0;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .opt {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch);
    padding: 0 var(--space-4);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-size: 15px;
  }

  .opt[aria-checked='true'] {
    border-color: var(--progress);
    background: var(--progress-tint);
    color: var(--progress);
    font-weight: 700;
  }

  .weight {
    font-size: 13px;
    color: var(--text-2);
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
