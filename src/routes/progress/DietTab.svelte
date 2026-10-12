<script lang="ts">
  import ChartTable from '../../lib/charts/ChartTable.svelte';
  import DivergingBars from '../../lib/charts/DivergingBars.svelte';
  import Heatmap from '../../lib/charts/Heatmap.svelte';
  import Legend from '../../lib/charts/Legend.svelte';
  import ViewToggle from '../../lib/charts/ViewToggle.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import ProgressRing from '../../lib/components/ProgressRing.svelte';
  import type { DietLogDay } from '../../lib/data/schemas/diet-log';
  import type { DietPlan } from '../../lib/data/schemas/diet-plans';
  import { DEVIATION_THRESHOLD_PCT } from '../../lib/diet/calc/observations';
  import { formatInt } from '../../lib/diet/format';
  import {
    adherenceSummary,
    dietDays,
    dietObservation,
    heatmapWeeks,
    macroAverages,
    targetDeviation,
  } from '../../lib/progress/diet';
  import { arrow, longDay, signedPct, weekdayDay } from '../../lib/progress/format';
  import { progressView, type CardView } from '../../lib/progress/state.svelte';
  import { routeHref } from '../../lib/routes';

  /**
   * Tab Dieta (SPEC § 5.7): aderenza, calendario dei pasti segnati, scarto dal target, macro medi e
   * osservazione dell'app. Parte sempre dal primo giorno del piano attivo; oggi è in corso.
   */
  interface Props {
    plans: readonly DietPlan[];
    logs: readonly DietLogDay[];
    today: string;
  }

  let { plans, logs, today }: Props = $props();

  const VIEWS = [
    { id: 'chart', label: 'Grafico' },
    { id: 'table', label: 'Tabella' },
  ] as const;
  const viewOf = (card: string): CardView => progressView.views[card] ?? 'chart';
  const setView = (card: string) => (v: CardView) => (progressView.views[card] = v);

  const active = $derived(plans.find((p) => p.active));
  const days = $derived(dietDays(plans, logs, today));
  const summary = $derived(adherenceSummary(days));
  const weeks = $derived(heatmapWeeks(days, today));
  const deviation = $derived(targetDeviation(days));
  const macros = $derived(macroAverages(days));
  const observation = $derived(dietObservation(macros));
  const start = $derived(days[0]?.date ?? null);

  let deviationSel = $derived.by(() => {
    void days;
    return -1;
  });

  const outCount = $derived(deviation.days.filter((d) => d.out).length);
  const excludedText = $derived.by(() => {
    const parts: string[] = [];
    const { noMeals, incomplete, noTarget } = deviation.excluded;
    const days = (n: number) => (n === 1 ? '1 giorno' : `${n} giorni`);
    if (noMeals) parts.push(`${days(noMeals)} senza pasti segnati`);
    if (incomplete) parts.push(`${days(incomplete)} con alimenti senza valori`);
    if (noTarget) parts.push(`${days(noTarget)} senza target`);
    return parts.length ? `Esclusi: ${parts.join(', ')}.` : '';
  });
  const pctText = (pct: number) => `${arrow(Math.round(pct))} ${signedPct(pct)}`;
  const deviationItems = $derived(
    deviation.days.map((d) => ({
      key: d.date,
      label: String(Number(d.date.slice(8))),
      pct: d.pct,
      out: d.out,
      tip: { title: weekdayDay(d.date), value: pctText(d.pct), extra: `${formatInt(d.kcal)} / ${formatInt(d.target)} kcal` },
    })),
  );
  const deviationSummary = $derived(
    `Scarto dal target: ${outCount} giorni su ${deviation.days.length} oltre il ${DEVIATION_THRESHOLD_PCT} per cento`,
  );

  const heatRows = $derived(
    days
      .filter((d) => d.pct !== null)
      .map((d) => ({
        key: d.date,
        cells: [weekdayDay(d.date) + (d.today ? ' · oggi' : ''), `${d.eaten} su ${d.planned}`, `${Math.round(d.pct ?? 0)} %`],
      }))
      .reverse(),
  );
  const deviationRows = $derived(
    deviation.days
      .map((d) => ({ key: d.date, cells: [weekdayDay(d.date), `${formatInt(d.kcal)} / ${formatInt(d.target)}`, pctText(d.pct)] }))
      .reverse(),
  );
</script>

{#if !active}
  <Card tone="food" label="Nessun piano alimentare">
    <h2 class="graffiti card-title">Nessun piano</h2>
    <p class="text" data-testid="diet-empty">
      Importa il piano del nutrizionista: qui vedrai quanti pasti segni ogni giorno e quanto ti avvicini ai target.
    </p>
    <Button tone="food" size="lg" href={routeHref('/importa')}>Importa un piano</Button>
  </Card>
{:else if days.length === 0 || !start}
  <Card tone="food" label="Piano non ancora iniziato">
    <h2 class="graffiti card-title">{active.title}</h2>
    <p class="text" data-testid="diet-not-started">Il piano non è ancora iniziato: i progressi partono dal suo primo giorno.</p>
  </Card>
{:else}
  <div class="tab">
    <Card tone="food" label="Aderenza al piano">
      <div class="adherence">
        <ProgressRing
          value={summary.average ?? 0}
          max={100}
          label={summary.average !== null ? `Aderenza al piano ${summary.average} per cento` : 'Aderenza: nessun giorno concluso'}
          text={summary.average !== null ? `${summary.average}%` : '—'}
          caption="ADERENZA"
          tone="food"
          size={112}
          stroke={11}
        />
        <div class="adh-text">
          <h2 class="graffiti plan-title">{active.title}</h2>
          {#if summary.days === 0}
            <p class="line">Il primo giorno è in corso: da domani vedrai la percentuale.</p>
          {:else}
            <p class="line" data-testid="perfect-days">
              {summary.perfect} {summary.perfect === 1 ? 'giorno' : 'giorni'} su {summary.days} con tutti i pasti segnati
            </p>
            <p class="line" data-testid="most-skipped">
              {summary.mostSkipped
                ? `Il più saltato: ${summary.mostSkipped.label} (${summary.mostSkipped.times} ${summary.mostSkipped.times === 1 ? 'volta' : 'volte'})`
                : 'Nessun pasto saltato'}
            </p>
          {/if}
          <span class="mono since">dal {longDay(start)} · oggi escluso</span>
        </div>
      </div>
    </Card>

    <Card tone="neutral" corners="b" label="Calendario dei pasti segnati">
      <h2 class="graffiti card-title">Pasti segnati</h2>
      <div class="subrow">
        <span class="mono sub">% per giorno</span>
        <ViewToggle options={VIEWS} value={viewOf('calendario')} label="Vista del calendario" tone="food" onchange={setView('calendario')} />
      </div>
      {#if viewOf('calendario') === 'chart'}
        <Heatmap {weeks} caption="Percentuale di pasti segnati per giorno" testid="heatmap" />
        <ul class="heat-legend mono" aria-label="Legenda del calendario">
          <li><span class="sw lv-low"></span>meno di 60</li>
          <li><span class="sw lv-60"></span>60</li>
          <li><span class="sw lv-80"></span>80</li>
          <li><span class="sw lv-100"></span>100</li>
          <li><span class="sw lv-none"></span>senza dati</li>
          <li><span class="sw lv-today"></span>oggi, in corso</li>
        </ul>
      {:else}
        <ChartTable
          caption="Pasti segnati per giorno"
          columns={[{ label: 'GIORNO' }, { label: 'PASTI', align: 'right' }, { label: '%', align: 'right' }]}
          rows={heatRows}
          testid="heatmap-table"
        />
      {/if}
    </Card>

    <Card tone="neutral" label="Scarto dal target">
      <h2 class="graffiti card-title">Scarto dal target</h2>
      <div class="subrow">
        <span class="mono sub">kcal · %</span>
        <ViewToggle options={VIEWS} value={viewOf('scarto')} label="Vista dello scarto" tone="food" onchange={setView('scarto')} />
      </div>
      {#if deviation.days.length === 0}
        <p class="text">Nessun giorno da confrontare ancora. {excludedText}</p>
      {:else}
        <p class="text" data-testid="deviation-summary">
          {outCount}
          {outCount === 1 ? 'giorno' : 'giorni'} su {deviation.days.length} oltre il ±{DEVIATION_THRESHOLD_PCT} % dal target del giorno. Un
          giorno fuori non è un problema: conta la media.
          {excludedText}
        </p>
        {#if viewOf('scarto') === 'chart'}
          <DivergingBars
            items={deviationItems}
            band={DEVIATION_THRESHOLD_PCT}
            summary={deviationSummary}
            bind:selected={deviationSel}
            testid="deviation-chart"
          />
          <Legend
            items={[
              { mark: '■', tone: 'food', text: `entro ±${DEVIATION_THRESHOLD_PCT} %` },
              { mark: '▨', tone: 'tip', text: `oltre ±${DEVIATION_THRESHOLD_PCT} % (▲ sopra, ▼ sotto)` },
            ]}
          />
        {:else}
          <ChartTable
            caption="Scarto dal target per giorno"
            columns={[{ label: 'GIORNO' }, { label: 'KCAL / TARGET', align: 'right' }, { label: 'SCARTO', align: 'right' }]}
            rows={deviationRows}
            testid="deviation-table"
          />
        {/if}
      {/if}
    </Card>

    <Card tone="neutral" corners="b" label="Macro medi">
      <h2 class="graffiti card-title">Macro medi</h2>
      <span class="mono sub">g/giorno · tacca = target</span>
      {#if macros.days === 0}
        <p class="text">Servono giorni conclusi con pasti segnati.</p>
      {:else}
        <ul class="macros" data-testid="macros">
          {#each macros.rows as m (m.field)}
            {@const fraction = m.target ? Math.min(m.eaten / m.target, 1.2) / 1.2 : 0}
            <li>
              <div class="macro-head">
                <span>{m.name}</span>
                <span class="mono macro-val">
                  <b>{formatInt(m.eaten)} / {m.target !== null ? formatInt(m.target) : '—'} g</b>
                  {#if m.pct !== null}
                    <span class="macro-delta" class:out={m.out}>{pctText(m.pct)}</span>
                  {/if}
                </span>
              </div>
              <div
                class="track"
                role="img"
                aria-label={m.target !== null
                  ? `${m.name}: ${formatInt(m.eaten)} grammi su ${formatInt(m.target)} di target`
                  : `${m.name}: ${formatInt(m.eaten)} grammi, target mancante`}
              >
                <div class="fill bar" style:transform="translateX({(fraction - 1) * 100}%)"></div>
                {#if m.target !== null}<div class="notch" style:left="{(100 / 120) * 100}%"></div>{/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <section class="obs" aria-label="Osservazione dell'app" data-testid="diet-observation">
      <NoteBox title="Osservazione dell'app" mark="✦" text={observation.text}>
        <p class="disclaimer">{observation.disclaimer}</p>
      </NoteBox>
    </section>
  </div>
{/if}

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-width: 0;
  }

  .card-title {
    font-size: 24px;
    color: var(--food);
  }

  .subrow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .subrow .sub {
    margin-top: 0;
  }

  .sub {
    margin-top: calc(-1 * var(--space-2));
    font-size: 12px;
    color: var(--muted);
  }

  .text {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-2);
  }

  .adherence {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .adh-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .plan-title {
    font-size: 22px;
    color: var(--food);
    overflow-wrap: anywhere;
  }

  .line {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-2);
  }

  .since {
    font-size: 11px;
    color: var(--muted);
  }

  .heat-legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 11px;
    color: var(--muted);
  }

  .heat-legend li {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .sw {
    width: 12px;
    height: 12px;
  }

  .sw.lv-low {
    background: var(--heat-low);
  }
  .sw.lv-60 {
    background: var(--heat-60);
  }
  .sw.lv-80 {
    background: var(--heat-80);
  }
  .sw.lv-100 {
    background: var(--heat-100);
  }
  .sw.lv-none {
    box-sizing: border-box;
    border: 1px dashed var(--line-strong);
  }
  .sw.lv-today {
    box-sizing: border-box;
    border: 2px dashed var(--food);
  }

  .macros {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .macro-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: 6px;
    font-size: 14px;
  }

  .macro-val {
    display: inline-flex;
    gap: 6px;
    align-items: baseline;
    font-size: 13px;
    white-space: nowrap;
  }

  .macro-delta {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }

  .macro-delta.out {
    color: var(--tip);
  }

  /* Il riempimento scorre con translateX: il ritaglio orizzontale lo tiene nella traccia, la tacca sporge in verticale. */
  .track {
    position: relative;
    height: 10px;
    background: var(--line);
    clip-path: inset(-4px 0);
  }

  .fill {
    position: absolute;
    inset: 0;
    background: var(--food);
  }

  .notch {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    margin-left: -1px;
    background: var(--text);
  }

  .disclaimer {
    margin: var(--space-2) 0 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
