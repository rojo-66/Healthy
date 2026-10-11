<script lang="ts">
  import type { Snippet } from 'svelte';

  // Banner inferiore fisso di Readiness e Intro (mockup: superficie, bordo magenta in alto).
  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<footer class="foot tone-training">
  {@render children()}
</footer>

<style>
  .foot {
    flex: none;
    position: relative;
    z-index: var(--z-banner);
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px calc(var(--space-5) + var(--safe-right)) max(14px, calc(var(--safe-bottom) + 8px))
      calc(var(--space-5) + var(--safe-left));
    background: var(--surface);
    box-shadow: inset 0 1px 0 var(--tone-edge);
  }

  .foot > :global(*:last-child) {
    flex: 1;
  }
</style>
