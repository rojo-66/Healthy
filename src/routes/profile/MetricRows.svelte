<script lang="ts">
  import { ORIGIN_SPOKEN, ORIGIN_TAG, type RowView } from '../../lib/profile/view';
  import Delta from './Delta.svelte';

  interface Props {
    rows: readonly RowView[];
  }

  let { rows }: Props = $props();
</script>

{#each rows as r (r.key)}
  <div class="row" data-testid="row-{r.key}">
    <div class="left">
      <span class="label">{r.label}</span>
      {#if r.before !== null}<span class="before">{r.before}</span>{/if}
    </div>
    <div class="right">
      <span class="now mono">
        {#if r.now.length === 0}
          —
        {:else}
          {#each r.now as part, i (i)}
            {#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}<span class="part"
              >{part.text}{#if part.origin !== 'measured'}<span class="tag" aria-hidden="true">{ORIGIN_TAG[part.origin]}</span
                ><span class="visually-hidden">({ORIGIN_SPOKEN[part.origin]})</span>{/if}</span
            >
          {/each}
        {/if}
      </span>
      <Delta delta={r.delta} align="end" />
    </div>
  </div>
{/each}

<style>
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }

  .left {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .label {
    font-size: 14px;
  }

  .before {
    font-size: 12px;
    color: var(--muted);
  }

  .right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
    max-width: 62%;
    text-align: right;
  }

  .now {
    font-weight: 700;
    font-size: 15px;
  }

  .part {
    white-space: nowrap;
  }

  .sep {
    margin: 0 0.35em;
    color: var(--muted);
  }

  .tag {
    margin-left: 0.3em;
    font-size: 10px;
    font-weight: 500;
    color: var(--muted);
  }
</style>
