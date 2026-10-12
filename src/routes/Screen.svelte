<script lang="ts">
  import type { Snippet } from 'svelte';
  import BottomNav, { type NavId } from '../lib/components/BottomNav.svelte';
  import { keyboardState } from '../lib/workouts/keyboard.svelte';

  interface Props {
    nav: NavId;
    /** Elemento che scorre (per `scrollIntoView` e per tornare in cima). */
    scroller?: HTMLElement;
    children: Snippet;
  }

  let { nav, scroller = $bindable(), children }: Props = $props();

  const keyboard = keyboardState();
</script>

<!--
  Schermo intero: scorre solo il corpo. La barra di navigazione è fissata al fondo della finestra
  (non dipende dall'altezza calcolata della pagina, che su iOS può restare vecchia: SPEC § 10).
  Con la tastiera aperta scivola via e ricompare quando si chiude.
-->
<div class="screen">
  <div class="body scroll" bind:this={scroller}>
    {@render children()}
  </div>
  <div class="dock" class:hidden={keyboard.open} inert={keyboard.open} data-testid="nav-dock">
    <BottomNav active={nav} />
  </div>
</div>

<style>
  .screen {
    height: var(--app-h);
  }

  .body {
    height: 100%;
    padding-bottom: calc(var(--nav-h) + var(--safe-bottom));
  }

  .dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-nav);
    transition:
      transform var(--dur-sheet) var(--ease-out),
      opacity var(--dur-fade) ease;
  }

  .dock.hidden {
    transform: translateY(100%);
    opacity: 0;
  }
</style>
