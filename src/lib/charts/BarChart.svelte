<script lang="ts" module>
  export interface Bar {
    key: string;
    /** Etichetta sotto la barra (es. "24/08"). */
    label: string;
    value: number;
    /** Periodo in corso (settimana non finita): barra tratteggiata. */
    partial?: boolean;
    /** Obiettivo di questa barra (2c): tacca tratteggiata sopra la barra. */
    target?: number | null;
  }

  export interface BarTip {
    title: string;
    value: string;
    extra?: string;
  }
</script>

<script lang="ts">
  import { formatInt } from '../diet/format';
  import { rise } from '../design/transitions';
  import { niceScale, scaleY } from '../progress/scale';
  import ChartFrame from './ChartFrame.svelte';
  import { barLayout, pickLabels, plotArea, tooltipPosition, type SeriesTone } from './geometry';

  /**
   * Grafico a barre (SPEC § 5.7): le barre partono sempre da zero e hanno gli angoli superiori arrotondati;
   * linea tratteggiata dell'obiettivo; la barra del periodo in corso è tratteggiata.
   */
  interface Props {
    bars: readonly Bar[];
    target: number | null;
    targetLabel?: string;
    tone: SeriesTone;
    /** Riassunto per lo screen reader. */
    summary: string;
    tip: (index: number) => BarTip;
    selected?: number;
    height?: number;
    testid?: string;
  }

  let { bars, target, targetLabel = '', tone, summary, tip, selected = $bindable(-1), height = 150, testid }: Props = $props();

  let width = $state(318);
  let tipW = $state(116);
  const INSETS = { left: 28, right: 6, top: 14, bottom: 24 };
  const RADIUS = 4;

  const n = $derived(bars.length);
  const si = $derived(selected < 0 || selected >= n ? n - 1 : selected);
  const plot = $derived(plotArea(width, height, INSETS));
  const scale = $derived(
    niceScale([...bars.map((b) => b.value), ...bars.map((b) => b.target ?? 0), target ?? 0], { zero: true, integer: true }),
  );
  const layout = $derived(barLayout(n, plot));
  const centers = $derived(bars.map((_, i) => layout.x(i) + layout.bar / 2));
  const base = $derived(plot.top + plot.height);
  const labels = $derived(new Set(pickLabels(centers, 38)));
  const y = (v: number) => scaleY(scale, v, plot.top, plot.height);

  /** Barra con gli angoli superiori arrotondati (vuota se il valore è 0). */
  function barPath(i: number, value: number): string {
    const top = y(value);
    const h = base - top;
    if (h <= 0.5) return '';
    const x = layout.x(i);
    const w = layout.bar;
    const r = Math.min(RADIUS, h, w / 2);
    return `M ${x} ${base} L ${x} ${top + r} Q ${x} ${top} ${x + r} ${top} L ${x + w - r} ${top} Q ${x + w} ${top} ${x + w} ${top + r} L ${x + w} ${base} Z`;
  }

  const current = $derived(bars[si]);
  const tipText = $derived(current ? tip(si) : null);
  const tipPos = $derived(
    tooltipPosition({ x: centers[si] ?? 0, y: current ? y(current.value) : base }, { width: tipW, height: 60 }, { width, height }),
  );
  const live = $derived(tipText ? [tipText.title, tipText.value, tipText.extra].filter(Boolean).join(', ') : '');
</script>

{#if n > 0}
  <div in:rise>
    <ChartFrame label={summary} xs={centers} selected={si} onselect={(i) => (selected = i)} {live} {height} bind:width {tone} {testid}>
      <svg {width} {height} aria-hidden="true">
        {#each scale.ticks as t (t)}
          <line class="grid" x1={plot.left} x2={plot.left + plot.width} y1={y(t)} y2={y(t)} />
          <text class="tick" x={plot.left - 8} y={y(t) + 3.5} text-anchor="end">{formatInt(t)}</text>
        {/each}
        {#each bars as bar, i (bar.key)}
          {@const d = barPath(i, bar.value)}
          {#if d}
            {#if i === si}
              <rect
                class="sel-ring"
                x={layout.x(i) - 3}
                y={y(bar.value) - 3}
                width={layout.bar + 6}
                height={base - y(bar.value) + 3}
                rx="5"
              />
            {/if}
            <path class="bar" class:partial={bar.partial} {d} />
          {/if}
          {#if bar.target !== undefined && bar.target !== null}
            <line class="target bar-target" x1={layout.x(i) - 2} x2={layout.x(i) + layout.bar + 2} y1={y(bar.target)} y2={y(bar.target)} />
          {/if}
          {#if labels.has(i)}
            <text class="date" class:on={i === si} x={centers[i]} y={height - 6} text-anchor="middle">{bar.label}</text>
          {/if}
        {/each}
        {#if target !== null}
          <line class="target" x1={plot.left} x2={plot.left + plot.width} y1={y(target)} y2={y(target)} />
          <text class="target-label" x={plot.left + plot.width} y={y(target) - 5} text-anchor="end">{targetLabel}</text>
        {/if}
      </svg>
      {#if tipText}
        <div class="tip" style:left="{tipPos.left}px" style:top="{tipPos.top}px" bind:offsetWidth={tipW} data-testid="chart-tooltip">
          <span class="tip-date">{tipText.title}</span>
          <span class="tip-value">{tipText.value}</span>
          {#if tipText.extra}<span class="tip-extra">{tipText.extra}</span>{/if}
        </div>
      {/if}
    </ChartFrame>
  </div>
{/if}

<style>
  svg {
    position: absolute;
    inset: 0;
    overflow: visible;
  }

  .grid {
    stroke: var(--line);
  }

  .tick,
  .date,
  .target-label {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--muted);
  }

  .date.on {
    fill: var(--text);
    font-weight: 700;
  }

  .bar {
    fill: var(--tone);
  }

  .bar.partial {
    fill: var(--tone-tint);
    stroke: var(--tone);
    stroke-width: 2;
    stroke-dasharray: 4 3;
  }

  .sel-ring {
    fill: none;
    stroke: var(--text);
    stroke-width: 2;
    filter: drop-shadow(0 0 6px var(--tone-glow));
  }

  .target {
    stroke: var(--text);
    stroke-dasharray: 4 4;
    opacity: 0.7;
  }

  .bar-target {
    stroke-width: 2;
    stroke-dasharray: 3 2;
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
    background: var(--bg);
    border: 1px solid var(--line-strong);
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .tip-date {
    font-size: 11px;
    color: var(--muted);
  }

  .tip-value {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
  }

  .tip-extra {
    font-size: 11px;
    color: var(--text-2);
  }
</style>
