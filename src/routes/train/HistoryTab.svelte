<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import { liveState } from '../../lib/data/live.svelte';
  import { listRunLogs } from '../../lib/data/repo/runs';
  import { completedSessions } from '../../lib/data/repo/sessions';
  import type { RunLog } from '../../lib/data/schemas/runs';
  import type { Session } from '../../lib/data/schemas/sessions';
  import { runLogLabel } from '../../lib/runs/format';
  import RunLogSheet from './RunLogSheet.svelte';
  import { fromIsoDate, isoWeekday, MONTHS, toIsoDate, WEEKDAY_INITIALS } from '../../lib/diet/calc/calendar';
  import { addMonths, compareMonths, inMonth, monthGrid, monthOf, monthSummary, sessionDate, sessionsInMonth } from '../../lib/sessions/calendar';
  import { durationShort, volumeLabel } from '../../lib/sessions/format';
  import { summaryHref } from '../../lib/sessions/nav';
  import { readinessTotal } from '../../lib/sessions/readiness';
  import { recordCountsBySession } from '../../lib/sessions/records';
  import { durationSec, volume } from '../../lib/sessions/stats';
  import { weekdayShort } from '../../lib/workouts/format';

  // Storico (SPEC § 5.2): calendario del mese navigabile, sessioni concluse (→ Riepilogo) e corse fatte (2a, ciano).
  interface Props {
    today: Date;
  }

  let { today }: Props = $props();

  const all = liveState<Session[]>(completedSessions, []);
  const runLogs = liveState<RunLog[]>(listRunLogs, []);
  const todayIso = untrack(() => toIsoDate(today));
  const records = $derived(recordCountsBySession(all.current));

  const current = untrack(() => monthOf(today));
  let month = $state(current);
  const isCurrent = $derived(compareMonths(month, current) >= 0);
  const monthName = $derived(MONTHS[month.month] ?? '');
  const title = $derived(month.year === current.year ? monthName : `${monthName} ${month.year}`);
  const cells = $derived(
    monthGrid(
      month,
      all.current,
      today,
      runLogs.current.map((l) => l.date),
    ),
  );
  const totals = $derived(monthSummary(all.current, month, records));
  const monthRuns = $derived(runLogs.current.filter((l) => inMonth(l.date, month)));

  /** Sessioni e corse del mese, dalla più recente (per giorno, poi per orario). */
  type Entry = { kind: 'session'; key: string; date: string; at: string; s: Session } | { kind: 'run'; key: string; date: string; at: string; log: RunLog };
  const list = $derived(
    [
      ...sessionsInMonth(all.current, month).map((s): Entry => ({ kind: 'session', key: s.id, date: sessionDate(s), at: s.startedAt, s })),
      ...monthRuns.map((log): Entry => ({ kind: 'run', key: log.id, date: log.date, at: log.loggedAt, log })),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at)),
  );
  const empty = $derived(all.loaded && runLogs.loaded && all.current.length === 0 && runLogs.current.length === 0);

  // Corsa fatta: dettaglio con Modifica / Elimina.
  let logOpen = $state(false);
  let openLog = $state.raw<RunLog | null>(null);
  let status = $state('');

  function cellLabel(c: (typeof cells)[number]): string {
    const parts: string[] = [];
    if (c.sessions > 0) parts.push(c.sessions === 1 ? '1 sessione' : `${c.sessions} sessioni`);
    if (c.runs > 0) parts.push(c.runs === 1 ? '1 corsa' : `${c.runs} corse`);
    const what = parts.join(' e ') || 'nessuna attività';
    return `${c.day} ${monthName.toLowerCase()}${c.isToday ? ', oggi' : ''}: ${what}`;
  }

  function meta(s: Session): string {
    const parts = [durationShort(durationSec(s)), volumeLabel(volume(s.sets))];
    if (s.readiness) parts.push(`R${readinessTotal(s.readiness)}`);
    return parts.join(' · ');
  }
</script>

<div class="history">
  <section class="month" aria-labelledby="h-month">
    <div class="month-head">
      <button type="button" class="nav tap" aria-label="Mese precedente" onclick={() => (month = addMonths(month, -1))}>
        <Icon name="back" size={20} />
      </button>
      <h2 id="h-month" class="graffiti">{title}</h2>
      <button type="button" class="nav tap" aria-label="Mese successivo" disabled={isCurrent} onclick={() => (month = addMonths(month, 1))}>
        <Icon name="forward" size={20} />
      </button>
    </div>
    <span class="mono count" data-testid="month-count">
      {totals.sessions === 1 ? '1 sessione' : `${totals.sessions} sessioni`}{monthRuns.length > 0
        ? ` · ${monthRuns.length === 1 ? '1 corsa' : `${monthRuns.length} corse`}`
        : ''}{totals.records > 0 ? ` · ${totals.records} PR` : ''}
    </span>
    <div class="grid initials mono" aria-hidden="true">
      {#each WEEKDAY_INITIALS as l, i (i)}<span>{l}</span>{/each}
    </div>
    <div class="grid" role="list" aria-label="Giorni di {title.toLowerCase()}">
      {#each cells as c, i (c.date ?? `blank-${i}`)}
        {#if c.date}
          <span class="cell mono {c.kind}" class:today={c.isToday} role="listitem" aria-label={cellLabel(c)}>{c.day}</span>
        {:else}
          <span class="cell blank" aria-hidden="true"></span>
        {/if}
      {/each}
    </div>
    <div class="legend">
      <span><b class="sq training" aria-hidden="true">■</b> palestra</span>
      <span><b class="sq run" aria-hidden="true">■</b> corsa</span>
      <span><b class="sq rest" aria-hidden="true">■</b> riposo</span>
    </div>
  </section>

  <h3 class="mono-label">Sessioni e corse</h3>
  <p class="status" role="status" aria-live="polite">{status}</p>
  {#if empty}
    <div class="empty">
      <p class="empty-title graffiti">Nessun allenamento ancora</p>
      <p class="empty-text">
        Quando completi una sessione o segni una corsa la trovi qui, con durata, volume, record o passo. Il calendario si colora
        giorno per giorno.
      </p>
    </div>
  {:else if list.length === 0}
    <p class="none">Nessuna attività a {title.toLowerCase()}.</p>
  {:else}
    <div class="list">
      {#each list as e (e.key)}
        {#if e.kind === 'run'}
          {@const d = fromIsoDate(e.date)}
          <button
            type="button"
            class="row run tap"
            data-testid="history-run"
            onclick={() => {
              openLog = e.log;
              status = '';
              logOpen = true;
            }}
          >
            <span class="day mono">
              <span class="dow">{weekdayShort(isoWeekday(d))}</span>
              <span class="n">{d.getDate()}</span>
            </span>
            <span class="main">
              <span class="title"><span class="name">{e.log.runName}</span></span>
              <span class="meta mono">{runLogLabel(e.log)}</span>
            </span>
            <Icon name="forward" size={18} />
          </button>
        {:else}
        {@const s = e.s}
        {@const d = new Date(s.startedAt)}
        {@const prs = records.get(s.id) ?? 0}
        <a class="row tap" href={summaryHref(s.id, true)} data-testid="history-row">
          <span class="day mono">
            <span class="dow">{weekdayShort(isoWeekday(d))}</span>
            <span class="n">{d.getDate()}</span>
          </span>
          <span class="main">
            <span class="title">
              <span class="name">{s.workoutName}</span>
              {#if prs > 0}<span class="pr">{prs} PR</span>{/if}
            </span>
            <span class="meta mono">{meta(s)}</span>
          </span>
          <Icon name="forward" size={18} />
        </a>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<RunLogSheet bind:open={logOpen} run={null} log={openLog} date={todayIso} today={todayIso} onsaved={(m) => (status = m)} />

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
    align-items: center;
    gap: var(--space-2);
  }

  .month-head h2 {
    flex: 1;
    font-size: 24px;
    text-align: center;
  }

  .nav {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--progress);
  }

  .nav:disabled {
    opacity: 0.3;
  }

  .count {
    align-self: center;
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

  .cell.rest {
    background: var(--line);
  }

  .cell.gym {
    background: var(--training);
    color: var(--on-tone);
    font-weight: 700;
  }

  .cell.today {
    outline: 2px solid var(--text);
    outline-offset: 1px;
    color: var(--text);
  }

  .cell.run {
    background: var(--progress);
    color: var(--on-tone);
    font-weight: 700;
  }

  /* Palestra e corsa nello stesso giorno: metà magenta e metà ciano. */
  .cell.both {
    background: linear-gradient(135deg, var(--training) 50%, var(--progress) 50%);
    color: var(--on-tone);
    font-weight: 700;
  }

  .cell.gym.today,
  .cell.run.today,
  .cell.both.today {
    color: var(--on-tone);
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
  .sq.run {
    color: var(--progress);
  }
  .sq.rest {
    color: var(--line-strong);
  }

  .status:empty {
    display: none;
  }

  .status {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  h3 {
    margin: 0;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 64px;
    padding: var(--space-3) 14px;
    border: 0;
    background: var(--surface);
    color: var(--text);
    text-align: left;
    text-decoration: none;
  }

  .row.run .day .n {
    color: var(--progress);
  }

  .row > :global(svg) {
    color: var(--muted);
  }

  .day {
    flex: none;
    width: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .dow {
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--muted);
  }

  .day .n {
    font-weight: 700;
    font-size: 20px;
    color: var(--training);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pr {
    flex: none;
    padding: 1px 6px;
    background: var(--training);
    color: var(--on-tone);
    font-family: var(--font-graffiti);
    font-size: 12px;
    transform: rotate(-4deg);
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }

  .none {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
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
