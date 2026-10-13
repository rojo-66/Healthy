<script lang="ts">
  import BarChart from '../../lib/charts/BarChart.svelte';
  import ChartTable from '../../lib/charts/ChartTable.svelte';
  import Legend from '../../lib/charts/Legend.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import ViewToggle from '../../lib/charts/ViewToggle.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import type { CalendarEdit } from '../../lib/data/schemas/calendar';
  import type { Run, RunLog } from '../../lib/data/schemas/runs';
  import type { Session } from '../../lib/data/schemas/sessions';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { formatDecimal, formatInt } from '../../lib/diet/format';
  import { dayMonth } from '../../lib/profile/format';
  import { arrow, pointDate, shortDay, spansYears, tonnes } from '../../lib/progress/format';
  import type { DateRange } from '../../lib/progress/period';
  import { progressView, type CardView, type StrengthMetric } from '../../lib/progress/state.svelte';
  import {
    exerciseChoices,
    exerciseView,
    recentRecords,
    weeklyWorkouts,
    type StrengthIndex,
  } from '../../lib/progress/strength';
  import { routeHref } from '../../lib/routes';
  import Delta from './Delta.svelte';

  /** Tab Forza (SPEC § 5.7): andamento per esercizio, allenamenti a settimana, record recenti. */
  interface Props {
    index: StrengthIndex;
    sessions: readonly Session[];
    workouts: readonly Workout[];
    /** Corse pianificate e fatte (2a): contano negli allenamenti a settimana. */
    runs?: readonly Run[];
    runLogs?: readonly RunLog[];
    /** Spostamenti e salti (2c): l'obiettivo di ogni settimana sono le attività previste dopo le modifiche. */
    edits?: readonly CalendarEdit[];
    range: DateRange | null;
    today: string;
  }

  let { index, sessions, workouts, runs = [], runLogs = [], edits = [], range, today }: Props = $props();

  const VIEWS = [
    { id: 'chart', label: 'Grafico' },
    { id: 'table', label: 'Tabella' },
  ] as const;
  const METRICS = [
    { id: 'load', label: 'Carico' },
    { id: 'volume', label: 'Volume' },
  ] as const;
  const viewOf = (card: string): CardView => progressView.views[card] ?? 'chart';
  const setView = (card: string) => (v: CardView) => (progressView.views[card] = v);

  const kg = (v: number) => formatDecimal(v, 1, true);
  const signedKg = (d: number) => `${arrow(d)} ${d > 0 ? '+' : d < 0 ? '−' : ''}${kg(Math.abs(d))} kg`;

  const choices = $derived(exerciseChoices(index));
  const chosen = $derived(choices.find((c) => c.key === progressView.exercise) ?? choices[0]);
  const metric = $derived(progressView.metric);
  const isLoad = $derived(metric === 'load');
  const view = $derived(exerciseView(chosen, metric, range));
  const weekly = $derived(weeklyWorkouts(sessions, workouts, range, today, runs, runLogs, edits));
  const records = $derived(recentRecords(index, range, 5));

  // Cambiando periodo, esercizio o misura si torna all'ultimo punto.
  let exerciseSel = $derived.by(() => {
    void range;
    void chosen?.key;
    void metric;
    return -1;
  });
  let weekSel = $derived.by(() => {
    void range;
    return -1;
  });

  const value = $derived(isLoad ? kg : (v: number) => formatInt(v));
  const lastPoint = $derived(view.points.at(-1));
  const nowText = $derived(lastPoint ? (isLoad ? `${kg(lastPoint.kg)} × ${lastPoint.reps}` : formatInt(lastPoint.volume)) : '—');
  const bestText = $derived(view.best ? (isLoad ? `${kg(view.best.kg)} kg` : formatInt(view.best.volume)) : '—');
  const multiYear = $derived(spansYears(view.points.map((p) => p.date)));

  const exerciseRows = $derived(
    view.points
      .map((p, i) => {
        const prev = view.series[i - 1];
        const cur = view.series[i]?.value ?? 0;
        const d = prev ? Math.round((cur - prev.value) * 100) / 100 : null;
        return {
          key: p.sessionId,
          cells: [
            pointDate(p.date, multiYear) + (p.record ? ' · PR' : ''),
            isLoad ? `${kg(p.kg)} × ${p.reps}` : `${formatInt(p.volume)} kg`,
            d === null ? 'prima' : signedKg(d),
          ],
        };
      })
      .reverse(),
  );

  const weekBars = $derived(
    weekly.weeks.map((w) => ({ key: w.monday, label: dayMonth(w.monday), value: w.count, partial: w.current, target: w.target })),
  );
  const doneWeeks = $derived(weekly.weeks.filter((w) => !w.current));
  const average = $derived(doneWeeks.length ? doneWeeks.reduce((s, w) => s + w.count, 0) / doneWeeks.length : null);
  const weekSummary = $derived(
    `Allenamenti a settimana: ${weekly.weeks.length} settimane` +
      (average !== null ? `, in media ${formatDecimal(average, 1, true)} a settimana` : '') +
      (weekly.hasTarget ? ', con l’obiettivo di ogni settimana' : ''),
  );
  function weekTip(i: number) {
    const w = weekly.weeks[i];
    if (!w) return { title: '', value: '' };
    const count = w.target !== null ? `${w.count} su ${w.target}` : `${w.count} ${w.count === 1 ? 'allenamento' : 'allenamenti'}`;
    const split = w.runs > 0 ? `${w.gym} palestra · ${w.runs} ${w.runs === 1 ? 'corsa' : 'corse'} · ` : '';
    return {
      title: `Sett. del ${dayMonth(w.monday)}`,
      value: count + (w.current ? ' · in corso' : ''),
      extra: `${split}volume ${tonnes(w.volumeKg)}`,
    };
  }
  const weekRows = $derived(
    weekly.weeks
      .map((w, i) => {
        const tip = weekTip(i);
        return { key: w.monday, cells: [tip.title.replace('Sett. del ', ''), tip.value, tonnes(w.volumeKg)] };
      })
      .reverse(),
  );
</script>

{#if sessions.length === 0}
  <Card tone="training" label="Nessun allenamento">
    <h2 class="graffiti card-title">Primo allenamento</h2>
    <p class="text" data-testid="strength-empty">
      Qui vedrai carichi, volume e record di ogni esercizio. Fai il primo allenamento da Allena: alla fine della sessione
      i dati arrivano qui da soli.
    </p>
    <Button tone="training" size="lg" href={routeHref('/allena')}>Vai ad Allena</Button>
  </Card>
{:else}
  <div class="tab">
    {#if choices.length > 0}
      <div class="chips scroll" role="group" aria-label="Esercizio" data-testid="exercise-chips" data-swipe-ignore>
        {#each choices as c (c.key)}
          <button type="button" class="chip tap" aria-pressed={c.key === chosen?.key} onclick={() => (progressView.exercise = c.key)}>
            {c.name}
          </button>
        {/each}
      </div>
    {/if}

    <Card tone="training" label="Andamento dell'esercizio">
      <div class="head">
        <h2 class="graffiti card-title ellipsis" data-testid="exercise-title">{chosen?.name ?? 'Esercizi'}</h2>
        {#if chosen}
          <ViewToggle
            options={METRICS}
            value={metric}
            label="Misura"
            tone="training"
            onchange={(m: StrengthMetric) => (progressView.metric = m)}
          />
        {/if}
      </div>
      {#if !chosen}
        <p class="text" data-testid="exercise-none">
          Per vedere l'andamento serve un esercizio fatto almeno 2 volte con un carico. Continua ad allenarti: comparirà
          qui.
        </p>
      {:else if view.points.length === 0}
        <p class="text">Nessuna sessione di {chosen.name} in questo periodo: prova «Tutto».</p>
      {:else}
        <div class="now-row">
          <div class="now">
            <span class="mono big" data-testid="exercise-now">{nowText}<span class="unit">{isLoad ? 'kg × rip' : 'kg'}</span></span>
            {#if view.delta !== null}
              <Delta
                text="{signedKg(view.delta)} dal {pointDate(view.points[0]?.date ?? '', false)}"
                tone={isLoad && view.delta > 0 ? 'good' : 'neutral'}
              />
            {/if}
          </div>
          <ViewToggle options={VIEWS} value={viewOf('esercizio')} label="Vista dell'esercizio" tone="training" onchange={setView('esercizio')} />
        </div>
        {#if viewOf('esercizio') === 'chart'}
          <LineChart
            points={view.series}
            tone="training"
            name={`${chosen.name}, ${isLoad ? 'carico migliore' : 'volume'}`}
            unit="kg"
            {value}
            delta={signedKg}
            extra={isLoad ? (i) => ` × ${view.points[i]?.reps ?? ''}` : undefined}
            pr={isLoad ? view.points.map((p) => p.record !== null) : undefined}
            firstText="prima sessione"
            singleText="Con un'altra sessione vedrai l'andamento."
            bind:selected={exerciseSel}
            testid="exercise-chart"
          />
          <Legend
            items={isLoad
              ? [
                  { mark: '◆', tone: 'training', text: 'record personale' },
                  { mark: '●', tone: 'training', text: 'sessione normale' },
                ]
              : [{ mark: '●', tone: 'training', text: 'volume della sessione (Σ kg × rip)' }]}
          />
        {:else}
          <ChartTable
            caption={chosen.name}
            columns={[{ label: 'DATA' }, { label: isLoad ? 'MIGLIORE' : 'VOLUME', align: 'right' }, { label: 'VS PRIMA', align: 'right' }]}
            rows={exerciseRows}
            testid="exercise-table"
          />
        {/if}
      {/if}
    </Card>

    {#if chosen && view.points.length > 0}
      <div class="stats" data-testid="strength-stats">
        <div class="stat"><span class="mono stat-label">SESSIONI</span><span class="mono stat-value">{view.sessions}</span></div>
        <div class="stat"><span class="mono stat-label">RECORD</span><span class="mono stat-value">{view.records}</span></div>
        <div class="stat"><span class="mono stat-label">MIGLIORE</span><span class="mono stat-value">{bestText}</span></div>
      </div>
    {/if}

    <Card tone="neutral" corners="b" label="Allenamenti a settimana">
      <h2 class="graffiti card-title">Allenamenti a settimana</h2>
      <div class="head">
        <span class="mono sub">sessioni concluse</span>
        <ViewToggle options={VIEWS} value={viewOf('settimane')} label="Vista delle settimane" tone="training" onchange={setView('settimane')} />
      </div>
      {#if viewOf('settimane') === 'chart'}
        <BarChart
          bars={weekBars}
          target={null}
          tone="training"
          summary={weekSummary}
          tip={weekTip}
          bind:selected={weekSel}
          testid="weeks-chart"
        />
        <Legend
          items={[
            { mark: '■', tone: 'training', text: 'sessioni fatte' },
            ...(weekly.hasTarget ? [{ mark: '- -', text: 'obiettivo: attività previste dopo spostamenti e salti' }] : []),
            { mark: '▭', text: 'tratteggiata = settimana in corso' },
          ]}
        />
      {:else}
        <ChartTable
          caption="Allenamenti a settimana"
          columns={[{ label: 'SETTIMANA' }, { label: 'FATTI', align: 'right' }, { label: 'VOLUME', align: 'right' }]}
          rows={weekRows}
          testid="weeks-table"
        />
      {/if}
    </Card>

    <Card tone="neutral" label="Record recenti">
      <h2 class="graffiti card-title">Record recenti</h2>
      {#if records.length === 0}
        <p class="text">Nessun record in questo periodo.</p>
      {:else}
        <ul class="records" data-testid="recent-records">
          {#each records as r (r.key + r.date)}
            <li>
              <span class="sticker" aria-hidden="true">PR</span>
              <span class="visually-hidden">Record personale:</span>
              <span class="rec-text">
                <span class="rec-name">{r.name}</span>
                <span class="rec-sub">{shortDay(r.date)} · prima {kg(r.previousKg)} kg</span>
              </span>
              <span class="mono rec-now">{kg(r.kg)} × {r.reps}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </div>
{/if}

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-width: 0;
  }

  .chips {
    display: flex;
    gap: var(--space-2);
    margin: 0 calc(-1 * var(--space-5));
    padding: 0 var(--space-5) var(--space-1);
    overflow-x: auto;
  }

  .chip {
    flex-shrink: 0;
    height: var(--touch);
    padding: 0 14px;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--text-2);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  .chip[aria-pressed='true'] {
    border-color: var(--training);
    background: var(--training);
    color: var(--on-tone);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .sub {
    font-size: 12px;
    color: var(--muted);
  }

  .card-title {
    font-size: 24px;
    color: var(--training);
  }

  .ellipsis {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .text {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text-2);
  }

  .now-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .now {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-width: 0;
  }

  .big {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
  }

  .unit {
    margin-left: 0.25em;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    padding: var(--space-3);
    background: var(--surface);
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  }

  .stat-label {
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--muted);
  }

  .stat-value {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
  }

  .records {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .records li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }

  .sticker {
    flex-shrink: 0;
    padding: 3px 7px;
    background: var(--tip);
    color: var(--on-tone);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    transform: rotate(-4deg);
  }

  .rec-text {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .rec-name {
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .rec-sub {
    font-size: 12px;
    color: var(--muted);
  }

  .rec-now {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
  }
</style>
