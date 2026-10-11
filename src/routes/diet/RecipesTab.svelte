<script lang="ts">
  import { tick } from 'svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import type { DietRecipe } from '../../lib/data/schemas/diet-payload';
  import { drop, prefersReducedMotion } from '../../lib/design/transitions';

  interface Props {
    recipes: readonly DietRecipe[];
    /** Ricetta aperta (una alla volta, come nel mockup); `null` = tutte chiuse. */
    open: number | null;
    /** Cambia a ogni "Ricetta N" toccato nel Piano: apre e scorre fino alla ricetta. */
    focusToken: number;
    fromMyDiet: boolean;
  }

  let { recipes, open = $bindable(), focusToken, fromMyDiet }: Props = $props();

  const uid = $props.id();

  $effect(() => {
    if (focusToken === 0 || open === null) return;
    const n = open;
    void tick().then(() => {
      document.getElementById(`${uid}-r${n}`)?.scrollIntoView({
        block: 'start',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    });
  });
</script>

<div class="recipes tone-food">
  {#each recipes as r (r.n)}
    {@const isOpen = open === r.n}
    <div class="recipe" id="{uid}-r{r.n}" data-recipe={r.n}>
      <button
        type="button"
        class="head tap"
        aria-expanded={isOpen}
        aria-controls="{uid}-b{r.n}"
        onclick={() => (open = isOpen ? null : r.n)}
      >
        <span class="n mono">{r.n}</span>
        <span class="text">
          <span class="name">{r.name}</span>
          {#if r.meta}<span class="meta mono">{r.meta}</span>{/if}
        </span>
        <span class="chev" class:up={isOpen} aria-hidden="true"><Icon name="chevronDown" size={16} /></span>
      </button>
      {#if isOpen}
        <div class="body" id="{uid}-b{r.n}" in:drop>
          {#if r.dose}<p class="dose">{r.dose}</p>{/if}
          {#if r.steps.length > 0}
            <ol>
              {#each r.steps as step, i (i)}<li>{step}</li>{/each}
            </ol>
          {/if}
          {#if r.tip}<NoteBox title="Consiglio" mark="✦" text={r.tip} />{/if}
        </div>
      {/if}
    </div>
  {:else}
    <p class="empty">
      {fromMyDiet ? 'Nessuna ricetta nel piano. Il file di MyDiet non contiene ricette.' : 'Nessuna ricetta nel piano.'}
    </p>
  {/each}
</div>

<style>
  .recipes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .recipe {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    scroll-margin-top: var(--space-4);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 60px;
    padding: var(--space-3) 14px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
  }

  .n {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    background: var(--bg);
    font-weight: 700;
    font-size: 13px;
    color: var(--tone);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .name {
    font-size: 15px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: 11px;
    color: var(--muted);
  }

  .chev {
    flex: none;
    display: flex;
    color: var(--muted);
    transition: transform var(--dur-fade) ease;
  }

  .chev.up {
    transform: rotate(180deg);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 14px var(--space-4);
  }

  .dose {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--tone);
  }

  ol {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .empty {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
  }
</style>
