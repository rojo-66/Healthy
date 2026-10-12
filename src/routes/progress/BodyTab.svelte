<script lang="ts">
  import ChartTable from '../../lib/charts/ChartTable.svelte';
  import Legend from '../../lib/charts/Legend.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import MiniLine from '../../lib/charts/MiniLine.svelte';
  import ViewToggle from '../../lib/charts/ViewToggle.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import type { Goal } from '../../lib/data/schemas/profile';
  import { deltaSpoken, deltaText, metricText, metricWithUnit } from '../../lib/profile/format';
  import { METRICS, roundFor } from '../../lib/profile/metrics';
  import {
    BODY_KEYS,
    bodyChange,
    bodyTableRows,
    CIRCUMFERENCE_KEYS,
    COMPOSITION_KEYS,
    COMPOSITION_LABELS,
    nextMeasurementDate,
    type BodyKey,
    type BodySeries,
  } from '../../lib/progress/body';
  import { chartSummary, pointDate } from '../../lib/progress/format';
  import type { DateRange } from '../../lib/progress/period';
  import { pointsIn } from '../../lib/progress/series';
  import { progressView, type CardView } from '../../lib/progress/state.svelte';
  import { routeHref } from '../../lib/routes';
  import BodyTables from './BodyTables.svelte';
  import Delta from './Delta.svelte';

  /** Tab Corpo (SPEC § 5.7): peso, composizione (bioimpedenza) e circonferenze dalle misure del Profilo. */
  interface Props {
    series: BodySeries;
    range: DateRange | null;
    goal: Goal | null;
    next: { date: string | null };
    today: string;
  }

  let { series, range, goal, next, today }: Props = $props();

  const VIEWS = [
    { id: 'chart', label: 'Grafico' },
    { id: 'table', label: 'Tabella' },
  ] as const;
  const viewOf = (card: string): CardView => progressView.views[card] ?? 'chart';
  const setView = (card: string) => (v: CardView) => (progressView.views[card] = v);

  const hasAny = $derived(BODY_KEYS.some((key) => series[key].length > 0));
  const inRange = $derived(
    Object.fromEntries(BODY_KEYS.map((key) => [key, pointsIn(series[key], range)])) as unknown as BodySeries,
  );

  const weight = $derived(inRange.weight);
  const weightChange = $derived(bodyChange('weight', weight, goal));
  const lastWeight = $derived(series.weight.at(-1));
  // Cambiando periodo si torna all'ultimo punto (−1).
  let weightSel = $derived.by(() => {
    void range;
    return -1;
  });

  const value = (key: BodyKey) => (v: number) => metricText(key, v);
  const delta = (key: BodyKey) => (d: number) => deltaText(key, roundFor(key, d) || 0);
  const unitOf = (key: BodyKey) => (METRICS[key].unit === '°' ? '°' : METRICS[key].unit);

  /** Prossima misura per un piccolo grafico: solo dopo il suo ultimo punto e non ancora passata. */
  const nextFor = (key: BodyKey) => nextMeasurementDate(next, inRange[key].at(-1)?.date ?? null, today);
  const showsNext = $derived(COMPOSITION_KEYS.some((key) => inRange[key].length > 0 && nextFor(key) !== null));

  const circFrom = $derived(
    CIRCUMFERENCE_KEYS.map((key) => inRange[key][0]?.date)
      .filter((d): d is string => d !== undefined)
      .sort()[0],
  );

  const WEIGHT_COLUMNS = [
    { label: 'DATA' },
    { label: 'PESO', align: 'right' as const },
    { label: 'VS PRIMA', align: 'right' as const },
  ];
</script>

{#if !hasAny}
  <Card tone="progress" label="Nessuna misura">
    <h2 class="graffiti card-title">Prima misura</h2>
    <p class="text" data-testid="body-empty">
      Qui vedrai peso, composizione e circonferenze nel tempo. Inserisci una misura nel Profilo: basta la data e un
      valore, per esempio il peso.
    </p>
    <Button tone="progress" size="lg" href={routeHref('/profilo/misura')}>+ Aggiungi una misura nel Profilo</Button>
  </Card>
{:else}
  <div class="tab">
    <Card tone="progress" label="Peso">
      <div class="head">
        <h2 class="graffiti card-title">Peso</h2>
        <ViewToggle options={VIEWS} value={viewOf('peso')} label="Vista del peso" tone="progress" onchange={setView('peso')} />
      </div>
      {#if weight.length === 0}
        <p class="text" data-testid="weight-none">
          {lastWeight
            ? `Nessun peso in questo periodo. L'ultimo è ${metricWithUnit('weight', lastWeight.value)} del ${pointDate(lastWeight.date, true)}.`
            : 'Nessuna misura con il peso: aggiungilo alla prossima misura.'}
        </p>
      {:else}
        <div class="now">
          <span class="mono big" data-testid="weight-now">{metricText('weight', weightChange.now)}<span class="unit">kg</span></span>
          {#if weightChange.delta !== null}
            <Delta
              text="{deltaText('weight', weightChange.delta)} dal {pointDate(weight[0]?.date ?? '', false)}"
              tone={weightChange.tone}
              spoken="{deltaSpoken('weight', weightChange.delta)} dal {pointDate(weight[0]?.date ?? '', true)}"
              testid="weight-delta"
            />
          {/if}
        </div>
        {#if viewOf('peso') === 'chart'}
          <LineChart
            points={weight}
            tone="progress"
            name="Peso"
            unit="kg"
            value={value('weight')}
            delta={delta('weight')}
            firstText="prima misura"
            singleText="Con un'altra misura vedrai l'andamento."
            bind:selected={weightSel}
            testid="weight-chart"
          />
        {:else}
          <ChartTable caption="Peso" columns={WEIGHT_COLUMNS} rows={bodyTableRows('weight', weight)} testid="weight-table" />
        {/if}
      {/if}
      <p class="foot">Il peso da solo non dice se cambia acqua, grasso o muscolo: guarda la composizione qui sotto.</p>
    </Card>

    <Card tone="neutral" corners="b" label="Composizione corporea">
      <div class="head">
        <h2 class="graffiti card-title">Composizione</h2>
        <ViewToggle
          options={VIEWS}
          value={viewOf('composizione')}
          label="Vista della composizione"
          tone="progress"
          onchange={setView('composizione')}
        />
      </div>
      <span class="mono sub">bioimpedenza · ogni grafico ha la sua scala</span>
      {#if viewOf('composizione') === 'chart'}
        <div class="grid" data-testid="composition">
          {#each COMPOSITION_KEYS as key (key)}
            {@const pts = inRange[key]}
            {@const change = bodyChange(key, pts, goal)}
            <div class="mini-card">
              <span class="mono mini-label">{COMPOSITION_LABELS[key]}</span>
              <span class="mono mini-now">{metricText(key, change.now)}<span class="unit" class:deg={unitOf(key) === '°'}>{unitOf(key)}</span></span>
              {#if change.delta !== null}
                <Delta text={deltaText(key, change.delta)} tone={change.tone} spoken={deltaSpoken(key, change.delta)} />
              {:else}
                <span class="mono mini-note">{pts.length === 1 ? 'una sola misura' : 'nessun dato'}</span>
              {/if}
              {#if pts.length > 0}
                <MiniLine
                  points={pts}
                  tone={key === 'fmKg' ? 'fat' : 'progress'}
                  label={chartSummary(METRICS[key].label, pts, value(key), unitOf(key))}
                  next={nextFor(key)}
                />
              {/if}
            </div>
          {/each}
        </div>
        <Legend
          items={[
            { mark: '●', tone: 'progress', text: 'massa magra, cellule, acqua' },
            { mark: '●', tone: 'fat', text: 'massa grassa' },
            ...(showsNext ? [{ mark: '○', text: 'tratteggiato = prossima misura' }] : []),
          ]}
        />
        {#if COMPOSITION_KEYS.every((key) => inRange[key].length < 2)}
          <p class="text small">
            {COMPOSITION_KEYS.some((key) => inRange[key].length === 1)
              ? "Con un'altra bioimpedenza vedrai l'andamento."
              : 'Nessuna bioimpedenza in questo periodo.'}
          </p>
        {/if}
      {:else}
        <BodyTables items={COMPOSITION_KEYS.map((key) => ({ key, label: METRICS[key].label, points: inRange[key] }))} />
      {/if}
    </Card>

    <Card tone="neutral" label="Circonferenze">
      <div class="head">
        <h2 class="graffiti card-title">Circonferenze</h2>
        <ViewToggle
          options={VIEWS}
          value={viewOf('circonferenze')}
          label="Vista delle circonferenze"
          tone="progress"
          onchange={setView('circonferenze')}
        />
      </div>
      <span class="mono sub">cm{circFrom ? ` · dal ${pointDate(circFrom, false)}` : ''}</span>
      {#if viewOf('circonferenze') === 'chart'}
        <ul class="circ" data-testid="circumferences">
          {#each CIRCUMFERENCE_KEYS as key (key)}
            {@const pts = inRange[key]}
            {@const change = bodyChange(key, pts, goal)}
            <li class="circ-row">
              <span>{METRICS[key].label}</span>
              {#if pts.length > 0}
                <MiniLine
                  points={pts}
                  tone="progress"
                  label={chartSummary(METRICS[key].label, pts, value(key), 'cm')}
                  height={28}
                  dates={false}
                />
              {:else}
                <span class="none" aria-hidden="true"></span>
              {/if}
              <span class="mono circ-now">{metricText(key, change.now)}</span>
              {#if change.delta !== null}
                <Delta text={deltaText(key, change.delta, false)} tone={change.tone} spoken={deltaSpoken(key, change.delta)} />
              {:else}
                <span class="mono circ-note">—</span>
              {/if}
            </li>
          {/each}
        </ul>
        <Legend
          items={[
            { mark: '▲▼', tone: 'progress', text: 'nella direzione giusta' },
            { mark: '▲▼', tone: 'tip', text: "da tenere d'occhio" },
            { mark: '■', text: 'nessun cambio o neutra' },
          ]}
        />
      {:else}
        <BodyTables items={CIRCUMFERENCE_KEYS.map((key) => ({ key, label: METRICS[key].label, points: inRange[key] }))} />
      {/if}
    </Card>

    <Button variant="secondary" size="lg" block href={routeHref('/profilo/misura')}>+ Aggiungi una misura nel Profilo</Button>
  </div>
{/if}

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-width: 0;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .card-title {
    font-size: 24px;
    color: var(--progress);
  }

  .text {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text-2);
  }

  .text.small {
    font-size: 13px;
  }

  .now {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .big {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.1;
  }

  .unit {
    margin-left: 0.25em;
    font-size: 14px;
    font-weight: 500;
    color: var(--muted);
  }

  .foot {
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--muted);
  }

  .sub {
    margin-top: calc(-1 * var(--space-2));
    font-size: 12px;
    color: var(--muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .mini-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--line);
  }

  .mini-label {
    font-size: 11px;
    letter-spacing: 1px;
    color: var(--muted);
  }

  .mini-now {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
  }

  .mini-now .unit {
    font-size: 12px;
  }

  .mini-now .unit.deg {
    margin-left: 0;
  }

  .mini-note,
  .circ-note {
    font-size: 12px;
    color: var(--muted);
  }

  .circ {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .circ-row {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr) 46px 64px;
    gap: var(--space-2);
    align-items: center;
    min-height: 32px;
    font-size: 14px;
  }

  .circ-row > :global(.delta) {
    text-align: right;
  }

  .circ-now {
    font-weight: 700;
    text-align: right;
  }

  .circ-note {
    text-align: right;
  }

  .none {
    height: 1px;
    background: var(--line);
  }
</style>
