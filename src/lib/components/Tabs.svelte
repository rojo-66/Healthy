<script lang="ts" generics="Id extends string">
  import type { Snippet } from 'svelte';
  import { swipe } from '../design/swipe-action';
  import type { SwipeDir } from '../design/swipe';
  import { fade } from '../design/transitions';
  import { indicatorTransform, nextTabIndex } from './tabs';
  import type { Tone } from './types';

  interface Props {
    tabs: readonly { id: Id; label: string }[];
    selected: Id;
    /** Nome del gruppo per gli screen reader, es. "Sezioni". */
    label: string;
    tone: Tone;
    onchange?: (id: Id) => void;
    /** Contenuto del pannello della tab attiva. */
    panel?: Snippet<[Id]>;
    /** Swipe orizzontale sul pannello e sulla barra per cambiare tab (di base sì, se c'è il pannello). */
    swipeable?: boolean;
  }

  let { tabs, selected = $bindable(), label, tone, onchange, panel, swipeable = true }: Props = $props();

  const uid = $props.id();
  let list: HTMLDivElement;
  const index = $derived(Math.max(0, tabs.findIndex((t) => t.id === selected)));

  function select(i: number, focus = false) {
    const tab = tabs[i];
    if (!tab) return;
    if (tab.id !== selected) {
      selected = tab.id;
      onchange?.(tab.id);
    }
    if (focus) list.querySelectorAll<HTMLButtonElement>('[role="tab"]')[i]?.focus();
  }

  // --- Swipe (§ 4): il contenuto segue il dito, l'evidenziatore si sposta in proporzione ---
  let panelTarget = $state<HTMLDivElement>();
  /** Frazione di tab trascinata (+ verso la successiva); 0 = ferma. Con `dragging` segue il dito senza ritardo. */
  let progress = $state(0);
  let dragging = $state(false);
  /** Cambio fatto con lo swipe: il pannello nuovo entra con il movimento dello swipe (al tocco: dissolvenza). */
  let viaSwipe = false;

  function onswipe(dir: SwipeDir) {
    viaSwipe = true;
    select(index + dir);
  }

  function enter(node: Element) {
    const swiped = viaSwipe;
    viaSwipe = false;
    return fade(node, { duration: swiped ? 0 : 200 });
  }

  function onkeydown(e: KeyboardEvent) {
    const next = nextTabIndex(e.key, index, tabs.length);
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  }
</script>

<div
  class="tabs tone-{tone}"
  use:swipe={{
    canGo: (d) => tabs[index + d] !== undefined,
    onswipe,
    target: panelTarget,
    claims: (d) => swipeable && !!panel && tabs[index + d] !== undefined,
    onprogress: (f, drag) => {
      progress = f;
      dragging = drag;
    },
  }}
>
  <div class="list" role="tablist" aria-label={label} bind:this={list} style:--n={tabs.length}>
    <span
      class="indicator ind"
      class:dragging
      aria-hidden="true"
      style:transform={indicatorTransform(index + progress, tabs.length)}
    ></span>
    {#each tabs as tab, i (tab.id)}
      <button
        type="button"
        role="tab"
        class="tab tap"
        id="{uid}-tab-{tab.id}"
        aria-selected={i === index}
        aria-controls="{uid}-panel"
        tabindex={i === index ? 0 : -1}
        {onkeydown}
        onclick={() => select(i)}>{tab.label}</button
      >
    {/each}
  </div>

  {#if panel}
    <div class="panel" role="tabpanel" id="{uid}-panel" aria-labelledby="{uid}-tab-{selected}">
      <div bind:this={panelTarget}>
        {#key selected}
          <div in:enter>{@render panel(selected)}</div>
        {/key}
      </div>
    </div>
  {/if}
</div>

<style>
  .list {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    padding: var(--space-1);
    background: var(--surface);
  }

  .indicator {
    position: absolute;
    top: var(--space-1);
    left: var(--space-1);
    width: calc((100% - 2 * var(--space-1)) / var(--n));
    height: var(--touch);
    background: var(--tone);
    clip-path: polygon(
      var(--cut-s) 0,
      100% 0,
      100% calc(100% - var(--cut-s)),
      calc(100% - var(--cut-s)) 100%,
      0 100%,
      0 var(--cut-s)
    );
  }

  /* Mentre il dito trascina l'evidenziatore lo segue senza ritardo. */
  .indicator.dragging {
    transition: none;
  }

  .tab {
    position: relative;
    z-index: 1;
    height: var(--touch);
    min-width: 0;
    padding: 0 var(--space-2);
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab[aria-selected='true'] {
    color: var(--on-tone);
  }

  .tab:focus-visible {
    outline-offset: -4px;
    outline-color: var(--text);
  }

  .panel {
    padding-top: var(--space-4);
  }
</style>
