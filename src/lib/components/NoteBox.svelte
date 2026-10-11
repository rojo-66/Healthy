<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Intestazione, es. "Nota del PT", "Tip della sera", "Osservazione dell'app". */
    title: string;
    /** Simbolo prima dell'intestazione: ✎ per le note, ✦ per i consigli. */
    mark?: string;
    /** Testo della nota: mostrato come testo (mai HTML), a capo rispettati. */
    text?: string;
    children?: Snippet;
  }

  let { title, mark = '✎', text, children }: Props = $props();
</script>

<aside class="note" aria-label={title}>
  <span class="head mono-label"><span aria-hidden="true">{mark}</span> {title}</span>
  {#if text}<p>{text}</p>{/if}
  {@render children?.()}
</aside>

<style>
  .note {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: var(--space-3) 14px;
    background: var(--tip-tint);
    border: 1px dashed var(--tip-edge);
    color: var(--text);
  }

  .head {
    color: var(--tip);
  }

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
</style>
