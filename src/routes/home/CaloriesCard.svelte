<script lang="ts">
  import Card from '../../lib/components/Card.svelte';
  import type { HomeCalories } from '../../lib/today/home';
  import KcalMacros from '../diet/KcalMacros.svelte';

  interface Props {
    calories: HomeCalories;
  }

  let { calories }: Props = $props();
</script>

<!-- Resta montata cambiando giorno: l'unico anello non si ricrea, cambiano solo i valori. -->
<Card tone="food" label="Calorie e macro">
  <KcalMacros shown={calories.shown} targets={calories.targets} mode={calories.mode} size={124} stroke={12} textSize={24} />
  <p class="origin" data-testid="target-origin">
    {calories.originText}{#if !calories.hasTargets}
      · <a href="#/dieta/completa">completa il piano</a>{/if}
  </p>
  {#if !calories.shown.complete}
    <p class="partial">Alcuni alimenti sono senza valori nutrizionali: i totali sono parziali.</p>
  {/if}
</Card>

<style>
  .origin {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .origin a {
    display: inline-block;
    min-height: var(--touch);
    line-height: var(--touch);
    color: var(--progress);
  }

  .partial {
    margin: 0;
    font-size: 12px;
    color: var(--tip);
  }
</style>
