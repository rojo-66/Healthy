<script lang="ts">
  import type { Snippet } from 'svelte';
  import BottomNav, { type NavId } from '../lib/components/BottomNav.svelte';

  interface Props {
    nav: NavId;
    /** Elemento che scorre (per `scrollIntoView` e per tornare in cima). */
    scroller?: HTMLElement;
    children: Snippet;
  }

  let { nav, scroller = $bindable(), children }: Props = $props();
</script>

<!-- Schermo intero: scorre solo il corpo, la barra di navigazione resta ferma (come i mockup, niente position: fixed). -->
<div class="screen">
  <div class="body scroll" bind:this={scroller}>
    {@render children()}
  </div>
  <BottomNav active={nav} />
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  .body {
    flex: 1;
    min-height: 0;
  }
</style>
