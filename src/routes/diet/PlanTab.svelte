<script lang="ts">
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { lookup, ValidationError } from '../../lib/data/errors';
  import { setMealEaten } from '../../lib/data/repo/diet-log';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import type { DietPlan } from '../../lib/data/schemas/diet-plans';
  import { dietView, sourceOf, type DayInfo } from '../../lib/calendar/days';
  import { OBSERVATION_DISCLAIMER } from '../../lib/diet/calc/observations';
  import { swipe } from '../../lib/design/swipe-action';
  import { rise } from '../../lib/design/transitions';
  import { buildDayView, findDay, weekStrip } from '../../lib/diet/view';
  import { routeHref } from '../../lib/routes';
  import { missingTypeText } from '../../lib/today/day-type';
  import DietChoice from '../calendar/DietChoice.svelte';
  import DayStrip from './DayStrip.svelte';
  import DaySummary from './DaySummary.svelte';
  import MealCard from './MealCard.svelte';
  import VariantChips from './VariantChips.svelte';

  interface Props {
    plan: DietPlan;
    todayIso: string;
    todayWeekday: number;
    nowMinutes: number;
    /**
     * I 7 giorni della settimana (lunedì = 0) con il tipo di giornata dalle attività, il diario e la dieta scelta
     * (2c, `calendar/days.ts`): la Dieta usa da sola la variante giusta.
     */
    infos: readonly DayInfo[];
    /** Giorno del calendario selezionato nella striscia. */
    selected: number;
    onrecipe: (n: number) => void;
  }

  let { plan, todayIso, todayWeekday, nowMinutes, infos, selected = $bindable(), onrecipe }: Props = $props();

  const payload = $derived(plan.payload);
  const isToday = $derived(selected === todayWeekday);
  const info = $derived(infos[selected - 1]);

  const strip = $derived(weekStrip(payload, infos.map((i) => ({ type: i.type.request, mealsFrom: i.mealsFrom }))));
  const inUse = $derived(info ? dietView(info, plan, { today: isToday, nowMinutes }) : null);
  const typeNote = $derived(info ? missingTypeText(info.type) : '');

  // --- Varianti del giorno (2b): si consultano in sola lettura, le spunte restano sulla variante in uso ---
  /** Variante consultata; `undefined` = quella in uso. Si azzera cambiando giorno. */
  let peekType = $state<string | null | undefined>(undefined);
  $effect(() => {
    void selected;
    peekType = undefined;
  });
  const peeking = $derived(peekType !== undefined && inUse !== null && peekType !== inUse.typeKey);
  const view = $derived(
    peeking
      ? buildDayView(payload, selected, { today: false, eaten: {}, nowMinutes, mealsFrom: info?.mealsFrom ?? null, type: peekType })
      : inUse,
  );

  function typeLabel(type: string | null): string {
    if (type === null) return 'Senza tipo';
    return lookup(payload.dayTypes, type)?.label ?? type;
  }

  let error = $state<readonly string[]>([]);
  let dayTarget = $state<HTMLDivElement>();

  async function write(task: () => Promise<unknown>) {
    error = [];
    try {
      await task();
    } catch (e) {
      error = e instanceof ValidationError ? e.errors : ['Non sono riuscito a salvare: riprova.'];
    }
  }

  function tick(mealKey: string, value: boolean) {
    const view = inUse;
    if (!view) return;
    // La fonte del pasto (giorno e variante di adesso): se poi il tipo di giornata cambia, resta com'era.
    void write(() => setMealEaten(todayIso, plan.id, mealKey, value, sourceOf(view)));
  }

  // --- Swipe tra i giorni (§ 4): il contenuto segue il dito ---
  const inPlan = (weekday: number) => findDay(payload, weekday) !== undefined;
  const neighbour = (dir: -1 | 1) => {
    for (let d = selected + dir; d >= 1 && d <= 7; d += dir) if (inPlan(d)) return d;
    return null;
  };
  const prevDay = $derived(neighbour(-1));
  const nextDay = $derived(neighbour(1));

  function onswipe(dir: -1 | 1) {
    const target = dir === -1 ? prevDay : nextDay;
    if (target !== null) selected = target;
  }
</script>

<div class="plan">
  <!--
    Swipe tra i giorni (§ 4) su striscia e contenuto. Vince sempre sul cambio di tab, anche al primo/ultimo
    giorno (lì non succede niente). La striscia resta ferma.
  -->
  <div
    class="swipe"
    role="group"
    aria-label="Giorno mostrato: scorri a destra o a sinistra per cambiare giorno"
    data-testid="day-swipe"
    use:swipe={{ canGo: (dir) => (dir === -1 ? prevDay : nextDay) !== null, onswipe, target: dayTarget, claims: () => true }}
  >
    <DayStrip days={strip} {selected} today={todayWeekday} onselect={(d) => (selected = d)} />

    {#if view}
      <div class="day" bind:this={dayTarget}>
        <!-- Varianti del giorno (2b): sopra il riepilogo, che segue la variante mostrata. -->
        {#if inUse && inUse.variantTypes.length > 1}
          <VariantChips
            types={inUse.variantTypes}
            inUse={inUse.typeKey}
            shown={view.typeKey}
            labelOf={typeLabel}
            onselect={(type) => (peekType = type === inUse?.typeKey ? undefined : type)}
          />
        {/if}

        <!-- 2c: palestra e corsa nello stesso giorno → quale dieta; tipo che il piano non conosce → riga gialla. -->
        {#if info?.type.double}
          <DietChoice date={info.date} {todayIso} current={info.type.key} />
        {/if}
        {#if typeNote}
          <p class="type-note" data-testid="type-note">{typeNote}</p>
        {/if}

        <!-- Il riepilogo (con l'unico anello) resta montato: cambiano solo i valori. -->
        <DaySummary {view} today={isToday} calendarWeekday={selected} />

        <!-- Solo l'elenco del giorno si ricrea, con sola entrata: il vecchio sparisce subito, niente doppioni. -->

        {#key `${selected}-${inUse?.typeKey ?? ''}-${peeking ? peekType : ''}`}
          <div class="day-content" in:rise>
            {#if peeking}
              <p class="peek" data-testid="variant-peek">
                Variante {typeLabel(view.typeKey).toLowerCase()} · non è quella {isToday ? 'di oggi' : 'di questo giorno'}. Sola
                lettura: le spunte restano sulla variante in uso.
              </p>
            {/if}
            {#if view.fallback === 'other-day'}
              <NoteBox
                title="Pasti di {weekdayName(view.sourceWeekday).toLowerCase()}"
                mark="!"
                text="Questo giorno non ha la variante {typeLabel(view.typeKey).toLowerCase()}: si usano i pasti di {weekdayName(view.sourceWeekday).toLowerCase()}."
              />
            {:else if view.fallback === 'no-variant'}
              <NoteBox
                title="Variante {typeLabel(view.typeKey).toLowerCase()} assente"
                mark="!"
                text="Il piano non ha la variante {typeLabel(view.typeKey).toLowerCase()} per nessun giorno: restano i pasti del giorno, con i target da {typeLabel(view.typeKey).toLowerCase()}."
              />
            {/if}
            {#each view.meals as meal (meal.key)}
              <MealCard {meal} canTick={isToday && !peeking} ontick={(v) => tick(meal.key, v)} {onrecipe} />
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

        <!-- Valida per tutti i giorni: fuori dal {#key}, non si ricrea cambiando giorno. -->
        {#if plan.payload.generalNotes}
          <NoteBox title="Indicazioni generali del nutrizionista" mark="✎" text={plan.payload.generalNotes} />
        {/if}
      </div>
    {:else}
      <p class="empty">Questo giorno non è nel piano.</p>
    {/if}
  </div>

  {#if error.length > 0}
    <NoteBox title="Non salvato" mark="!" text={error.join('\n')} />
  {/if}

  <a class="cal-link tap" href={routeHref('/calendario', { giorno: info?.date ?? todayIso })}>Spostamenti e calendario →</a>
</div>

<style>
  .plan {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* Solo il contenuto del giorno segue il dito: la striscia resta ferma. */
  .swipe,
  .day {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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

  .peek {
    margin: 0;
    padding: 10px 12px;
    border: 1px dashed var(--line-strong);
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.4;
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

  /* Spostamenti e salti si fanno nel calendario: la Dieta segue da sola. */
  .cal-link {
    align-self: center;
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    color: var(--progress);
    font-size: 14px;
    text-decoration: none;
  }

  .type-note {
    margin: 0;
    padding: 10px 12px;
    border: 1px dashed var(--tip-edge);
    background: var(--tip-tint);
    color: var(--tip);
    font-size: 13px;
    line-height: 1.4;
  }
</style>
