<script lang="ts">
  import CheckButton from '../../lib/components/CheckButton.svelte';
  import { formatDecimal, formatInt } from '../../lib/diet/format';
  import type { MealView } from '../../lib/diet/view';

  interface Props {
    meal: MealView;
    /** Spunta "mangiato": solo per oggi. */
    canTick: boolean;
    ontick?: (eaten: boolean) => void;
    onrecipe?: (n: number) => void;
  }

  let { meal, canTick, ontick, onrecipe }: Props = $props();

  const head = $derived(
    [meal.isNow ? '● ADESSO' : '', meal.label.toUpperCase(), meal.time].filter(Boolean).join(' · '),
  );
  const t = $derived(meal.totals);
  const kcal = $derived(
    t.itemCount === 0 ? '' : t.complete ? `${formatInt(t.total.kcal)} kcal` : t.total.kcal > 0 ? `≥ ${formatInt(t.total.kcal)} kcal` : '— kcal',
  );
  const macro = $derived(
    `P ${formatDecimal(t.total.protein)} · C ${formatDecimal(t.total.carbs)} · G ${formatDecimal(t.total.fat)}`,
  );
</script>

<article class="meal tone-food" class:now={meal.isNow} class:eaten={meal.eaten} aria-label="{meal.label}: {meal.name}">
  <div class="top">
    <span class="head mono">{head}</span>
    {#if kcal}<span class="kcal mono">{kcal}</span>{/if}
  </div>
  <h3>{meal.name}</h3>
  {#if meal.items.length > 0}
    <ul class="items">
      {#each meal.items as item, i (i)}
        <li>
          <span class="name">{item.name}{#if item.missing}<span class="missing" title="senza valori nutrizionali"> *</span>{/if}</span>
          <b class="qty mono">{item.quantity}</b>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="bottom">
    <span class="macro mono">
      {#if t.itemCount > 0}
        {macro}{#if !t.complete}<span class="missing-note"> · * senza valori</span>{/if}
      {/if}
    </span>
    {#if meal.recipe !== null}
      <button type="button" class="recipe tap" onclick={() => onrecipe?.(meal.recipe!)}>Ricetta {meal.recipe}</button>
    {/if}
    {#if canTick}
      <CheckButton
        checked={meal.eaten}
        tone="food"
        label={meal.eaten ? `${meal.label} mangiato, tocca per annullare` : `Segna ${meal.label} come mangiato`}
        onchange={(v) => ontick?.(v)}
      />
    {/if}
  </div>
</article>

<style>
  .meal {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: var(--space-4);
    background: var(--surface);
    transition: opacity var(--dur-fade) ease;
  }

  /* Pasto del momento: bordo e bagliore verdi, angoli tagliati. */
  .meal.now {
    box-shadow: inset 0 0 0 1px var(--tone-edge);
    clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
  }

  .meal.eaten {
    opacity: 0.6;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .head {
    min-width: 0;
    font-size: 12px;
    letter-spacing: 1px;
    color: var(--muted);
  }
  .now .head {
    color: var(--tone);
  }

  .kcal {
    flex: none;
    font-size: 13px;
    color: var(--muted);
  }

  h3 {
    margin: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 21px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .items {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-1) var(--space-3);
    font-size: 13px;
  }

  .items li {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
    padding-bottom: 3px;
    border-bottom: 1px dashed var(--line);
  }

  .name {
    min-width: 0;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .qty {
    flex: none;
    color: var(--tone);
  }

  .missing,
  .missing-note {
    color: var(--tip);
  }

  .bottom {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .macro {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    color: var(--muted);
  }

  .recipe {
    flex: none;
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--text);
    font-size: 13px;
  }
</style>
