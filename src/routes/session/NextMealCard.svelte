<script lang="ts">
  import Icon from '../../lib/components/Icon.svelte';
  import type { NextMeal } from '../../lib/sessions/next-meal';

  // Collegamento alla dieta nel Riepilogo: il prossimo pasto del piano attivo (verde = alimentazione).
  interface Props {
    next: NextMeal;
  }

  let { next }: Props = $props();
  const items = $derived(next.meal.items.map((i) => `${i.name} ${i.quantity}`).join(' · '));
</script>

<a class="meal tap tone-food" href="#/dieta" aria-label="Prossimo pasto: {next.meal.label}, {next.meal.name}. Apri la dieta">
  <span class="text">
    <span class="mono-label kicker">
      ● {next.isNow ? 'Ora' : `Prossimo${next.meal.time ? ` · ${next.meal.time}` : ''}`} · {next.meal.label}
    </span>
    <span class="name">{next.meal.name}</span>
    {#if items}<span class="items">{items}</span>{/if}
  </span>
  <Icon name="forward" size={20} />
</a>

<style>
  .meal {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    padding: 14px var(--space-4);
    background: var(--tone-tint);
    box-shadow: inset 0 0 0 1px var(--tone-edge);
    color: var(--tone);
    text-decoration: none;
  }

  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .kicker {
    font-size: 11px;
    color: var(--tone);
  }

  .name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    overflow-wrap: anywhere;
  }

  .items {
    font-size: 12px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
</style>
