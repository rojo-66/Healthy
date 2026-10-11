<script lang="ts">
  import { addDays, fromIsoDate, isoWeekday, MONTHS, toIsoDate, WEEKDAY_INITIALS } from '../../lib/diet/calc/calendar';

  // Storico (M4): calendario del mese già pronto, senza sessioni. Il contenuto vero arriva nel M5.
  interface Props {
    today: Date;
  }

  let { today }: Props = $props();

  const todayIso = $derived(toIsoDate(today));
  const monthName = $derived(MONTHS[today.getMonth()] ?? '');
  const first = $derived(toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const cells = $derived.by(() => {
    const out: { date: string | null; n: number; past: boolean }[] = [];
    for (let i = 1; i < isoWeekday(fromIsoDate(first)); i++) out.push({ date: null, n: 0, past: false });
    for (let date = first; fromIsoDate(date).getMonth() === today.getMonth(); date = addDays(date, 1)) {
      out.push({ date, n: fromIsoDate(date).getDate(), past: date <= todayIso });
    }
    return out;
  });
</script>

<div class="history">
  <section class="month" aria-labelledby="h-month">
    <div class="month-head">
      <h2 id="h-month" class="graffiti">{monthName}</h2>
      <span class="mono count">0 sessioni</span>
    </div>
    <div class="grid initials mono" aria-hidden="true">
      {#each WEEKDAY_INITIALS as l, i (i)}<span>{l}</span>{/each}
    </div>
    <div class="grid" role="list" aria-label="Giorni di {monthName.toLowerCase()}">
      {#each cells as c, i (i)}
        {#if c.date}
          <span
            class="cell mono"
            class:past={c.past}
            class:today={c.date === todayIso}
            role="listitem"
            aria-label="{c.n} {monthName.toLowerCase()}{c.date === todayIso ? ', oggi' : ''}: nessuna sessione"
            >{c.n}</span
          >
        {:else}
          <span class="cell blank" aria-hidden="true"></span>
        {/if}
      {/each}
    </div>
    <div class="legend">
      <span><b class="sq training" aria-hidden="true">■</b> palestra</span>
      <span><b class="sq progress" aria-hidden="true">■</b> corsa</span>
      <span><b class="sq rest" aria-hidden="true">■</b> riposo</span>
    </div>
  </section>

  <h3 class="mono-label">Sessioni</h3>
  <div class="empty">
    <p class="empty-title graffiti">Nessun allenamento ancora</p>
    <p class="empty-text">
      Quando completi una sessione la trovi qui, con durata, volume e record. Il calendario si colora giorno per giorno.
    </p>
  </div>
</div>

<style>
  .history {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .month {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: var(--space-4);
    background: var(--surface);
  }

  .month-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .month-head h2 {
    font-size: 24px;
  }

  .count {
    font-size: 12px;
    color: var(--muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-1);
  }

  .initials {
    font-size: 10px;
    color: var(--muted);
    text-align: center;
  }

  .cell {
    height: 34px;
    display: grid;
    place-items: center;
    font-size: 12px;
    color: var(--muted);
  }

  .cell.past {
    background: var(--line);
  }

  .cell.today {
    outline: 2px solid var(--text);
    outline-offset: 1px;
    color: var(--text);
  }

  .legend {
    display: flex;
    gap: 14px;
    font-size: 11px;
    color: var(--muted);
  }

  .sq.training {
    color: var(--training);
  }
  .sq.progress {
    color: var(--progress);
  }
  .sq.rest {
    color: var(--line-strong);
  }

  h3 {
    margin: 0;
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    border: 1px dashed var(--line-strong);
    text-align: center;
  }

  .empty-title {
    font-size: 22px;
    color: var(--training);
    transform-origin: center;
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-2);
  }
</style>
