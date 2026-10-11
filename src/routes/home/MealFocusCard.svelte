<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import { recipeHref } from '../../lib/diet/links';
  import { formatInt } from '../../lib/diet/format';
  import { pop } from '../../lib/design/transitions';
  import type { MealFocus } from '../../lib/today/meal-focus';

  interface Props {
    focus: MealFocus;
    /** Il pasto si segna solo oggi. */
    canTick: boolean;
    ontick: (mealKey: string, eaten: boolean) => void;
  }

  let { focus, canTick, ontick }: Props = $props();

  const MODE_LABEL = { now: '● Adesso', next: 'Prossimo', preview: 'Anteprima', past: '' } as const;

  function kcalText(t: { itemCount: number; complete: boolean; total: { kcal: number } }): string {
    if (t.itemCount === 0) return '';
    if (t.complete) return `${formatInt(t.total.kcal)} kcal`;
    return t.total.kcal > 0 ? `≥ ${formatInt(t.total.kcal)} kcal` : '— kcal';
  }
</script>

{#if focus.kind === 'meal'}
  {@const meal = focus.meal}
  {@const mode = focus.mode === 'past' ? (meal.eaten ? '✓ Mangiato' : 'Non segnato') : MODE_LABEL[focus.mode]}
  <Card tone="food" corners="b" glow={focus.mode === 'now' && !meal.eaten} label="Pasto del momento">
    <div class="top">
      <span class="head mono-label" class:now={focus.mode === 'now'}>{[mode, meal.label, meal.time].filter(Boolean).join(' · ')}</span>
      {#if kcalText(meal.totals)}<span class="kcal mono">{kcalText(meal.totals)}</span>{/if}
    </div>
    <h2 class="name">{meal.name}</h2>
    {#if meal.items.length > 0}
      <ul class="items">
        {#each meal.items as item, i (i)}
          <li>
            <span class="item-name">{item.name}{#if item.missing}<span class="missing" title="senza valori nutrizionali"> *</span>{/if}</span>
            <b class="qty mono">{item.quantity}</b>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="free">Nessun alimento indicato.</p>
    {/if}
    {#if canTick || meal.recipe !== null}
      <div class="actions">
        {#if canTick}
          <button
            type="button"
            class="tick tap"
            class:done={meal.eaten}
            aria-pressed={meal.eaten}
            aria-label={meal.eaten ? `${meal.label} mangiato, tocca per annullare` : `Segna ${meal.label} come fatto`}
            onclick={() => ontick(meal.key, !meal.eaten)}
          >
            <!-- Due rami, mai "classe di animazione + key": la spunta entra con la transizione pop. -->
            {#if meal.eaten}
              <span in:pop>✓ Mangiato</span>
            {:else}
              <span>Segna come fatto</span>
            {/if}
          </button>
        {/if}
        {#if meal.recipe !== null}
          <a class="recipe tap" href={recipeHref(meal.recipe)}>Ricetta {meal.recipe}</a>
        {/if}
      </div>
    {/if}
  </Card>
{:else if focus.kind === 'finished'}
  <Card tone="food" corners="b" label="Pasto del momento">
    <span class="head mono-label">Pasti di oggi</span>
    <h2 class="name">Giornata chiusa</h2>
    <p class="text">
      Hai segnato {focus.eaten} {focus.total === 1 ? 'pasto' : 'pasti'} su {focus.total}.{#if focus.eaten < focus.total}
        Se ne hai dimenticato uno, puoi segnarlo in Dieta.{/if}
    </p>
    <Button tone="food" variant="secondary" href="#/dieta">Vai alla Dieta</Button>
  </Card>
{:else if focus.kind === 'no-meals'}
  <Card tone="food" corners="b" label="Pasto del momento">
    <span class="head mono-label">Pasti</span>
    <p class="text">Nessun pasto in programma per questo giorno.</p>
  </Card>
{:else if focus.kind === 'not-in-plan'}
  <Card tone="food" corners="b" label="Pasto del momento">
    <span class="head mono-label">Pasti</span>
    <p class="text">Questo giorno non è nel piano alimentare.</p>
    <Button tone="food" variant="secondary" href="#/dieta">Apri la Dieta</Button>
  </Card>
{/if}

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .head {
    min-width: 0;
    font-size: 12px;
  }
  .head.now {
    color: var(--tone);
  }

  .kcal {
    flex: none;
    font-size: 13px;
    color: var(--muted);
  }

  .name {
    margin: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 26px;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  .items {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 12px;
    font-size: 14px;
  }

  .items li {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .item-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .qty {
    flex: none;
    color: var(--tone);
  }

  .missing {
    color: var(--tip);
  }

  .free,
  .text {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text-2);
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .tick {
    flex: 1;
    min-height: 48px;
    border: 0;
    background: var(--tone);
    color: var(--on-tone);
    font-weight: 700;
    font-size: 15px;
    box-shadow: 0 0 18px var(--tone-glow);
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  }

  .tick.done {
    background: var(--line);
    color: var(--tone);
    box-shadow: none;
  }

  .tick span {
    display: inline-block;
  }

  .recipe {
    flex: none;
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 0 16px;
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-weight: 500;
    font-size: 14px;
    text-decoration: none;
  }
</style>
