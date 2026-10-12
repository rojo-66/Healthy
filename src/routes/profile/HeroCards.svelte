<script lang="ts">
  import type { HeroView } from '../../lib/profile/view';
  import Delta from './Delta.svelte';

  interface Props {
    cards: readonly HeroView[];
  }

  let { cards }: Props = $props();
</script>

<!-- Card fisse con chiavi stabili: cambiando le date cambiano solo i valori, mai le card. -->
<div class="grid">
  {#each cards as c (c.key)}
    <div class="card" data-testid="hero-{c.key}">
      <span class="label mono">
        {c.label}{#if c.estimated}<span class="tag">STIMATO</span>{/if}
      </span>
      <span class="value mono">{c.value}{#if c.value !== '—'}<span class="unit">{c.unit}</span>{/if}</span>
      <Delta delta={c.delta} empty={c.note} />
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    padding: 14px;
    background: var(--surface);
    clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  }

  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    letter-spacing: 1px;
    color: var(--muted);
    white-space: nowrap;
  }

  .tag {
    padding: 1px 4px;
    border: 1px solid var(--tip-edge);
    font-size: 9px;
    color: var(--tip);
  }

  .value {
    font-weight: 700;
    font-size: 26px;
    line-height: 1.1;
    white-space: nowrap;
  }

  .unit {
    margin-left: 0.3em;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }
</style>
