<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { ValidationError } from '../../lib/data/errors';
  import { setMealEaten, setSwap } from '../../lib/data/repo/diet-log';
  import type { DietLogDay } from '../../lib/data/schemas/diet-log';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import type { DietPlan } from '../../lib/data/schemas/diet-plans';
  import { effectiveWeekday } from '../../lib/diet/calc/calendar';
  import { OBSERVATION_DISCLAIMER } from '../../lib/diet/calc/observations';
  import { lockAxis, swipeDecision, swipeOffset } from '../../lib/diet/swipe';
  import { rise, prefersReducedMotion } from '../../lib/design/transitions';
  import { buildDayView, findDay, weekStrip } from '../../lib/diet/view';
  import DayStrip from './DayStrip.svelte';
  import DaySummary from './DaySummary.svelte';
  import MealCard from './MealCard.svelte';

  interface Props {
    plan: DietPlan;
    todayIso: string;
    todayWeekday: number;
    nowMinutes: number;
    /** Diario di oggi (solo se è dello stesso piano). */
    log: DietLogDay | undefined;
    /** Giorno del calendario selezionato nella striscia. */
    selected: number;
    onrecipe: (n: number) => void;
  }

  let { plan, todayIso, todayWeekday, nowMinutes, log, selected = $bindable(), onrecipe }: Props = $props();

  const payload = $derived(plan.payload);
  const todayLog = $derived(log && log.planId === plan.id ? log : undefined);
  const follows = $derived(effectiveWeekday(todayWeekday, todayLog?.swappedFromWeekday));
  const isToday = $derived(selected === todayWeekday);
  const shownWeekday = $derived(isToday ? follows : selected);
  const eaten = $derived(todayLog?.eaten ?? {});

  const strip = $derived(weekStrip(payload, todayWeekday, follows));
  const view = $derived(buildDayView(payload, shownWeekday, { today: isToday, eaten, nowMinutes }));

  let error = $state<readonly string[]>([]);

  async function write(task: () => Promise<unknown>) {
    error = [];
    try {
      await task();
    } catch (e) {
      error = e instanceof ValidationError ? e.errors : ['Non sono riuscito a salvare: riprova.'];
    }
  }

  function tick(mealKey: string, value: boolean) {
    void write(() => setMealEaten(todayIso, plan.id, mealKey, value));
  }

  // --- Scambio del giorno ---
  let swapOpen = $state(false);
  /** Scelta in attesa di conferma (ci sono spunte che verranno tolte). */
  let pendingSwap = $state<number | null>(null);
  const hasTicks = $derived(Object.values(eaten).some(Boolean));

  function chooseSwap(weekday: number) {
    if (weekday === follows) {
      swapOpen = false;
      return;
    }
    if (hasTicks && pendingSwap !== weekday) {
      pendingSwap = weekday;
      return;
    }
    pendingSwap = null;
    swapOpen = false;
    void write(() => setSwap(todayIso, plan.id, weekday === todayWeekday ? null : weekday));
  }

  // --- Swipe tra i giorni (§ 4): il contenuto segue il dito ---
  let swipeEl = $state<HTMLDivElement>();
  let start: { x: number; y: number } | null = null;
  let axis: boolean | null = null;
  let dx = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let suppressClick = false;

  const inPlan = (weekday: number) => findDay(payload, weekday === todayWeekday ? follows : weekday) !== undefined;
  const neighbour = (dir: -1 | 1) => {
    for (let d = selected + dir; d >= 1 && d <= 7; d += dir) if (inPlan(d)) return d;
    return null;
  };

  function onpointerdown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    axis = null;
    dx = 0;
    velocity = 0;
    lastX = e.clientX;
    lastT = e.timeStamp;
  }

  function onpointermove(e: PointerEvent) {
    if (!start || !swipeEl) return;
    const ddx = e.clientX - start.x;
    if (axis === null) {
      axis = lockAxis(ddx, e.clientY - start.y);
      if (axis === false) {
        start = null;
        return;
      }
      if (axis === true) {
        swipeEl.setPointerCapture(e.pointerId);
        swipeEl.style.transition = 'none';
      }
    }
    if (axis !== true) return;
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = e.timeStamp;
    dx = ddx;
    if (!prefersReducedMotion()) {
      swipeEl.style.transform = `translateX(${swipeOffset(dx, neighbour(-1) !== null, neighbour(1) !== null)}px)`;
    }
  }

  function onpointerup(e: PointerEvent) {
    if (!start || !swipeEl) return;
    const horizontal = axis === true;
    start = null;
    axis = null;
    if (!horizontal) return;
    // Il tocco finito con uno swipe non deve premere il pulsante sotto il dito.
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 50);
    if (e.timeStamp - lastT > 100) velocity = 0;
    const prev = neighbour(-1);
    const next = neighbour(1);
    const dir = swipeDecision(dx, velocity, swipeEl.offsetWidth, prev !== null, next !== null);
    swipeEl.style.transition = prefersReducedMotion() ? 'none' : 'transform var(--dur-ind) var(--spring)';
    swipeEl.style.transform = '';
    if (dir === -1 && prev !== null) selected = prev;
    if (dir === 1 && next !== null) selected = next;
  }

  function onclickcapture(e: MouseEvent) {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }
</script>

<div class="plan">
  <DayStrip days={strip} {selected} today={todayWeekday} onselect={(d) => (selected = d)} />

  {#if view}
    <div
      class="swipe"
      role="group"
      aria-label="Giorno mostrato: scorri a destra o a sinistra per cambiare giorno"
      bind:this={swipeEl}
      data-testid="day-swipe"
      {onpointerdown}
      {onpointermove}
      {onpointerup}
      onpointercancel={onpointerup}
      onclickcapture={onclickcapture}
    >
      <!-- Il riepilogo (con l'unico anello) resta montato: cambiano solo i valori. -->
      <DaySummary {view} today={isToday} calendarWeekday={selected} />

      <!-- Solo l'elenco del giorno si ricrea, con sola entrata: il vecchio sparisce subito, niente doppioni. -->
      {#key `${selected}-${shownWeekday}`}
        <div class="day-content" in:rise>
          {#each view.meals as meal (meal.key)}
            <MealCard {meal} canTick={isToday} ontick={(v) => tick(meal.key, v)} {onrecipe} />
          {:else}
            <p class="empty">Nessun pasto in programma.</p>
          {/each}

          {#if view.supplements.length > 0}
            <section class="supps" aria-labelledby="supps-title">
              <h3 id="supps-title" class="mono-label">Integratori</h3>
              <ul>
                {#each view.supplements as s, i (i)}
                  <li class:skip={s.skip}>
                    {[s.name, s.dose, s.when].filter(Boolean).join(' · ')}{#if s.skip}<span class="visually-hidden">
                        (non serve oggi)</span
                      >{/if}
                  </li>
                {/each}
              </ul>
            </section>
          {/if}

          {#if view.note}
            <NoteBox title="Nota del nutrizionista" mark="✎" text={view.note} />
          {/if}

          {#if view.observations.length > 0}
            <NoteBox title="Osservazione dell'app" mark="✦">
              {#each view.observations as o, i (i)}
                <p class="obs">{o.text}</p>
              {/each}
              <p class="disclaimer">{OBSERVATION_DISCLAIMER}</p>
            </NoteBox>
          {/if}
        </div>
      {/key}
    </div>
  {:else}
    <p class="empty">Questo giorno non è nel piano.</p>
  {/if}

  {#if error.length > 0}
    <NoteBox title="Non salvato" mark="!" text={error.join('\n')} />
  {/if}

  {#if isToday}
    <button type="button" class="swap tap" onclick={() => ((pendingSwap = null), (swapOpen = true))}>
      ⇄ {follows === todayWeekday
        ? 'Oggi seguo il piano di un altro giorno'
        : `Oggi segui il piano di ${weekdayName(follows).toLowerCase()} · cambia`}
    </button>
  {/if}
</div>

<BottomSheet bind:open={swapOpen} title="Quale piano segui oggi?" tone="food" onclose={() => (pendingSwap = null)}>
  <p class="sheet-text">Oggi mostro e conteggio i pasti del giorno che scegli.</p>
  <div class="swap-list">
    {#each [1, 2, 3, 4, 5, 6, 7] as d (d)}
      {#if findDay(payload, d)}
        <Button variant="secondary" tone="food" block pressed={d === follows} onclick={() => chooseSwap(d)}>
          {weekdayName(d)}{d === todayWeekday ? ' (quello di oggi)' : ''}
        </Button>
      {/if}
    {/each}
  </div>
  {#if pendingSwap !== null}
    <NoteBox title="Attenzione" mark="!" text="Le spunte di oggi verranno tolte, perché cambiano i pasti." />
    <div class="grid2">
      <Button variant="ghost" onclick={() => (pendingSwap = null)}>Annulla</Button>
      <Button tone="food" onclick={() => chooseSwap(pendingSwap!)}>Segui {weekdayName(pendingSwap).toLowerCase()}</Button>
    </div>
  {/if}
</BottomSheet>

<style>
  .plan {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .swipe {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    touch-action: pan-y;
  }

  .day-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .empty {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }

  .supps {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .supps h3 {
    margin: 0;
    font-size: 12px;
  }

  .supps ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .supps li {
    padding: 7px 10px;
    font-size: 13px;
    border: 1px solid var(--tip);
    color: var(--tip);
    overflow-wrap: anywhere;
  }

  .supps li.skip {
    border-color: var(--line-strong);
    color: var(--muted);
    text-decoration: line-through;
  }

  .obs {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
  }

  .disclaimer {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }

  .swap {
    min-height: 48px;
    padding: 0 var(--space-3);
    border: 1px dashed var(--line-strong);
    background: transparent;
    color: var(--text-2);
    font-size: 14px;
  }

  .sheet-text {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .swap-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
</style>
