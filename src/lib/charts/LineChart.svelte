<script lang="ts">
  import { formatDecimal, formatInt } from '../diet/format';
  import { rise } from '../design/transitions';
  import { chartSummary, pointDate, spansYears } from '../progress/format';
  import { niceScale, scaleY } from '../progress/scale';
  import { markerIndexes, timeFractions, type Point } from '../progress/series';
  import ChartFrame from './ChartFrame.svelte';
  import {
    areaPath,
    diamondPath,
    LINE_INSETS,
    linePath,
    pickLabels,
    plotArea,
    stepDigits,
    tooltipPosition,
    type SeriesTone,
  } from './geometry';

  /**
   * Grafico a linea (SPEC § 5.7): linea 2 px con area leggera, un solo asse che non parte da zero,
   * asse orizzontale proporzionale al tempo, punto selezionato più grande con alone e tooltip
   * (data, valore, variazione), rombi pieni per i record personali. Con un punto solo: il punto e un invito.
   */
  interface Props {
    points: readonly Point[];
    tone: SeriesTone;
    /** Nome del dato per il riassunto e l'annuncio ("Peso"). */
    name: string;
    unit: string;
    /** Valore senza unità: "88,9". */
    value: (v: number) => string;
    /** Variazione rispetto al punto prima, con freccia e unità: "▲ +0,3 kg". */
    delta: (d: number) => string;
    /** Testo aggiunto al valore nel tooltip (es. " × 6" ripetizioni). */
    extra?: (i: number) => string;
    pr?: readonly boolean[];
    /** Tooltip del primo punto, che non ha un "prima": "prima misura", "prima sessione". */
    firstText: string;
    /** Invito con un punto solo. */
    singleText: string;
    selected?: number;
    height?: number;
    testid?: string;
  }

  let {
    points,
    tone,
    name,
    unit,
    value,
    delta,
    extra,
    pr,
    firstText,
    singleText,
    selected = $bindable(-1),
    height = 176,
    testid,
  }: Props = $props();

  let width = $state(318);
  // Larghezza vera del tooltip (misurata), per tenerlo dentro il grafico.
  let tipW = $state(112);

  const n = $derived(points.length);
  const si = $derived(selected < 0 || selected >= n ? n - 1 : selected);
  const plot = $derived(plotArea(width, height, LINE_INSETS));
  const scale = $derived(niceScale(points.map((p) => p.value)));
  const xs = $derived(timeFractions(points.map((p) => p.date)).map((f) => plot.left + f * plot.width));
  const ys = $derived(points.map((p) => scaleY(scale, p.value, plot.top, plot.height)));
  const markers = $derived(markerIndexes(points, si));
  const labels = $derived(new Set(pickLabels(xs, 46)));
  const multiYear = $derived(spansYears(points.map((p) => p.date)));
  const digits = $derived(stepDigits(scale.step));
  const unitText = $derived(unit ? ` ${unit}` : '');

  const tickText = (t: number) => (digits === 0 ? formatInt(t) : formatDecimal(t, digits, true));

  const current = $derived(points[si]);
  const prev = $derived(si > 0 ? points[si - 1] : undefined);
  const tipDelta = $derived(current && prev ? `${delta(current.value - prev.value)} vs prima` : firstText);
  const isPr = $derived(!!pr?.[si]);
  const tipHeight = $derived(isPr ? 80 : 62);
  const tip = $derived(
    tooltipPosition({ x: xs[si] ?? 0, y: ys[si] ?? 0 }, { width: tipW, height: tipHeight }, { width, height }),
  );

  const summary = $derived(chartSummary(name, points, value, unit));
  const live = $derived(
    current
      ? `${pointDate(current.date, multiYear)}: ${value(current.value)}${unitText}${extra?.(si) ?? ''}, ${tipDelta}${isPr ? ', record personale' : ''}`
      : '',
  );
</script>

{#if n > 0}
  <div class="line-chart" in:rise>
    <ChartFrame label={summary} {xs} selected={si} onselect={(i) => (selected = i)} {live} {height} bind:width {tone} {testid}>
      <svg {width} {height} aria-hidden="true">
        {#each scale.ticks as t (t)}
          {@const y = scaleY(scale, t, plot.top, plot.height)}
          <line class="grid" x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y} />
          <text class="tick" x={plot.left - 8} y={y + 3.5} text-anchor="end">{tickText(t)}</text>
        {/each}
        {#if n > 1}
          <line class="cross" x1={xs[si]} x2={xs[si]} y1={plot.top} y2={plot.top + plot.height} />
          <path class="area" d={areaPath(xs, ys, plot.top + plot.height)} />
          <path class="line" d={linePath(xs, ys)} />
        {/if}
        {#each points as p, i (p.date + ':' + i)}
          {#if labels.has(i)}
            <text class="date" class:on={i === si} x={xs[i]} y={height - 8} text-anchor="middle">{pointDate(p.date, false)}</text>
          {/if}
        {/each}
        {#if current}
          <circle class="halo" cx={xs[si]} cy={ys[si]} r="11" />
        {/if}
        {#each points as p, i (p.date + ':' + i)}
          {#if markers.has(i)}
            <g transform="translate({xs[i]} {ys[i]})">
              {#if pr?.[i]}
                <path class="mark pr" class:sel={i === si} d={diamondPath(0, 0, 6.5)} />
              {:else}
                <circle class="mark dot" class:sel={i === si} r="5" />
              {/if}
            </g>
          {/if}
        {/each}
      </svg>
      {#if current}
        <div class="tip" style:left="{tip.left}px" style:top="{tip.top}px" bind:offsetWidth={tipW} data-testid="chart-tooltip">
          <span class="tip-date">{pointDate(current.date, multiYear)}</span>
          <span class="tip-value">{value(current.value)}{unitText}{extra?.(si) ?? ''}</span>
          <span class="tip-delta">{tipDelta}</span>
          {#if isPr}<span class="sticker">PR</span>{/if}
        </div>
      {/if}
    </ChartFrame>
    {#if n === 1}
      <p class="single">{singleText}</p>
    {/if}
  </div>
{/if}

<style>
  .line-chart {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  svg {
    position: absolute;
    inset: 0;
    overflow: visible;
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  .tick,
  .date {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--muted);
  }

  .date.on {
    fill: var(--text);
    font-weight: 700;
  }

  .cross {
    stroke: var(--line-strong);
    stroke-dasharray: 3 3;
  }

  .area {
    fill: var(--tone-tint);
  }

  .line {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
    filter: drop-shadow(0 0 5px var(--tone-glow));
  }

  .halo {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2;
    filter: drop-shadow(0 0 6px var(--tone-glow));
    pointer-events: none;
  }

  .mark {
    transform-box: fill-box;
    transform-origin: center;
    transition: transform var(--dur-ind) var(--spring);
  }

  .dot {
    fill: var(--surface);
    stroke: var(--tone);
    stroke-width: 2;
  }

  .pr {
    fill: var(--tone);
    stroke: var(--surface);
    stroke-width: 2;
  }

  .mark.sel {
    transform: scale(1.4);
  }

  .dot.sel {
    fill: var(--tone);
    stroke: var(--surface);
    stroke-width: 2.5;
  }

  .tip {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
    min-width: 100px;
    padding: 6px 8px;
    white-space: nowrap;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    font-family: var(--font-mono);
  }

  .tip-date {
    font-size: 11px;
    color: var(--muted);
  }

  .tip-value {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
  }

  .tip-delta {
    font-size: 11px;
    color: var(--text-2);
  }

  .sticker {
    align-self: flex-start;
    margin-top: 2px;
    padding: 2px 6px;
    background: var(--tip);
    color: var(--on-tone);
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    transform: rotate(-4deg);
  }

  .single {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-2);
  }

  @media (prefers-reduced-motion: reduce) {
    .mark {
      transition: none;
    }
  }
</style>
