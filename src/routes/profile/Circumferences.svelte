<script lang="ts">
  import ProgressBar from '../../lib/components/ProgressBar.svelte';
  import type { CircView } from '../../lib/profile/view';
  import Delta from './Delta.svelte';

  interface Props {
    rows: readonly CircView[];
  }

  let { rows }: Props = $props();
</script>

{#each rows as c (c.key)}
  <div class="row" data-testid="circ-{c.key}">
    <span class="label">{c.label}</span>
    <ProgressBar
      value={c.fraction}
      max={1}
      label={c.label}
      valueText={c.value === '—' ? 'non misurata' : `${c.value} cm`}
      tone="progress"
    />
    <span class="value mono">{c.value}</span>
    <Delta delta={c.delta} align="end" />
  </div>
{/each}

<style>
  .row {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr) 54px 60px;
    gap: 10px;
    align-items: center;
    font-size: 14px;
  }

  .row :global([role='progressbar']) {
    opacity: 0.75;
  }

  .value {
    font-weight: 700;
    text-align: right;
  }

  .row :global(.delta) {
    min-height: 0;
  }
</style>
