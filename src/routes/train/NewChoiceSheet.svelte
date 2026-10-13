<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import { routeHref } from '../../lib/routes';

  // "+ Nuova" in Allena (2a): scheda (palestra, magenta) o corsa (ciano).
  interface Props {
    open: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  function go(hash: string) {
    open = false;
    location.hash = hash;
  }
</script>

<BottomSheet bind:open title="Cosa vuoi creare?" tone="training">
  <div class="choices">
    <button type="button" class="choice tone-training tap" onclick={() => go(routeHref('/allena/editor'))}>
      <span class="t">Scheda</span>
      <span class="s">palestra: esercizi di forza e cardio, serie, carichi, giorni</span>
    </button>
    <button type="button" class="choice tone-progress tap" onclick={() => go(routeHref('/allena/corsa'))}>
      <span class="t">Corsa</span>
      <span class="s">giorni, orario, obiettivo in minuti e/o km</span>
    </button>
  </div>
</BottomSheet>

<style>
  .choices {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-height: 72px;
    padding: 14px;
    background: var(--bg);
    border: 1px solid var(--tone-edge);
    box-shadow: inset 3px 0 0 var(--tone);
    color: var(--text);
    text-align: left;
  }

  .t {
    font-family: var(--font-graffiti);
    font-size: 22px;
    color: var(--tone);
  }

  .s {
    font-size: 13px;
    color: var(--text-2);
  }
</style>
