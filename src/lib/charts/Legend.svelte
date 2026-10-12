<script lang="ts" module>
  import type { SeriesTone } from './geometry';

  /** Voce di legenda: simbolo nel colore della serie (o grigio) e testo. Il simbolo non è mai l'unico indizio. */
  export interface LegendItem {
    mark: string;
    text: string;
    tone?: SeriesTone | 'tip';
  }
</script>

<script lang="ts">
  interface Props {
    items: readonly LegendItem[];
  }

  let { items }: Props = $props();
</script>

<ul class="legend">
  {#each items as item, i (i)}
    <li>
      <b class={item.tone ? `tone-${item.tone}` : 'plain'} aria-hidden="true">{item.mark}</b>
      {item.text}
    </li>
  {/each}
</ul>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    line-height: 1.4;
    color: var(--muted);
  }

  b {
    color: var(--tone);
  }

  b.plain {
    color: var(--muted);
  }
</style>
