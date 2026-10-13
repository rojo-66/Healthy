<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../lib/components/Button.svelte';
  import TopBanner from '../../lib/components/TopBanner.svelte';
  import { dayInfos, dietView } from '../../lib/calendar/days';
  import { calendarCells } from '../../lib/calendar/grid';
  import { liveCalendar } from '../../lib/calendar/live.svelte';
  import { calendarWindow, canReschedule, datesBetween } from '../../lib/calendar/occurrences';
  import { shortDay } from '../../lib/calendar/move';
  import { fromIsoDate, toIsoDate, weekStartOf } from '../../lib/diet/calc/calendar';
  import { edgeSwipe } from '../../lib/sessions/edge-swipe';
  import { sessionDate } from '../../lib/sessions/calendar';
  import CalendarActions from './CalendarActions.svelte';
  import CalendarGrid from './CalendarGrid.svelte';
  import DayDetail from './DayDetail.svelte';

  /**
   * Calendario di 3 settimane (2c): settimana scorsa, questa e prossima. Toccando un giorno si apre il dettaglio con
   * Sposta, Salta, Ripristina e la scelta della dieta; in fondo "Ripristina la settimana".
   */
  interface Props {
    now: Date;
    /** Giorno da aprire (dall'indirizzo, testo: si usa solo se è nella finestra). */
    day: string;
    /** `allena`: indietro torna ad Allena; altrimenti alla Home. */
    from: string;
  }

  let { now, day, from }: Props = $props();

  const todayIso = toIsoDate(untrack(() => now));
  const win = calendarWindow(todayIso);
  const dates = datesBetween(win.from, win.to);
  const backHref = untrack(() => from) === 'allena' ? '#/allena' : '#/';

  const cal = liveCalendar(win.from, win.to);
  const input = $derived(cal.input(todayIso));
  const all = $derived(dayInfos(win.from, win.to, input, cal.diet));
  const cells = $derived(calendarCells(all.infos, cal.plan, todayIso));

  const requested = untrack(() => day);
  let selected = $state(dates.includes(requested) ? requested : todayIso);
  const index = $derived(dates.indexOf(selected));
  const info = $derived(all.infos[index]);
  const cell = $derived(cells[index]);
  const view = $derived(info ? dietView(info, cal.plan, { today: false, keepEaten: selected <= todayIso, nowMinutes: 0 }) : null);
  const extras = $derived([
    ...all.days.extraSessions.filter((s) => sessionDate(s) === selected).map((s) => s.workoutName),
    ...all.days.extraLogs.filter((l) => l.date === selected).map((l) => l.runName),
  ]);
  const monday = $derived(weekStartOf(fromIsoDate(selected)));

  let actions: CalendarActions;
</script>

<div class="screen tone-progress" use:edgeSwipe={() => (location.hash = backHref)}>
  <TopBanner title="Calendario" tone="progress" {backHref} backLabel={backHref === '#/allena' ? 'Torna ad Allena' : 'Torna a Oggi'} />

  <div class="body scroll">
    {#if !cal.loaded}
      <p class="hint">Carico il calendario…</p>
    {:else}
      <p class="intro">
        Sposta o salta un allenamento o una corsa solo per una data: la scheda non cambia e la dieta di quei giorni si adatta da
        sola.
      </p>
      <CalendarGrid {cells} {selected} onselect={(d) => (selected = d)} />
      <p class="legend mono">→ spostata · ✓ fatta · <s>barrata</s> saltata · ◆ dieta · % pasti segnati</p>

      {#if info && cell}
        <DayDetail
          {info}
          {cell}
          {view}
          {todayIso}
          {extras}
          canMove={(o) => canReschedule(o, win)}
          onmove={(o) => actions.move(o)}
          onskip={(o) => actions.skip(o)}
          onrestore={(o) => actions.restore(o)}
        />
      {/if}

      <Button variant="secondary" tone="neutral" block onclick={() => actions.restoreWeek(monday, input.edits, cal.diet.choices)}>
        Ripristina la settimana del {shortDay(monday)}
      </Button>
    {/if}
  </div>
</div>

<CalendarActions bind:this={actions} {input} diet={cal.diet} />

<style>
  .screen {
    position: relative;
    display: flex;
    flex-direction: column;
    height: var(--app-h);
    background-image: radial-gradient(circle at 90% 8%, var(--tone-tint), transparent 40%);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4) calc(var(--space-4) + var(--safe-right)) calc(120px + var(--safe-bottom))
      calc(var(--space-4) + var(--safe-left));
  }

  .intro {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text-2);
  }

  .legend {
    margin: calc(-1 * var(--space-2)) 0 0;
    font-size: 11px;
    color: var(--muted);
  }

  .hint {
    color: var(--muted);
  }
</style>
