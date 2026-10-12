<script lang="ts" module>
  export interface DivergingItem {
    key: string;
    /** Etichetta sotto la barra (es. "1"). */
    label: string;
    pct: number;
    /** Oltre la soglia: tratteggio, contorno giallo e ▲/▼ (mai solo il colore). */
    out: boolean;
    tip: { title: string; value: string; extra?: string };
  }
</script>

<script lang="ts">
  import { formatInt } from '../diet/format';
  import { rise } from '../design/transitions';
  import { divergingScale, scaleY } from '../progress/scale';
  import ChartFrame from './ChartFrame.svelte';
  import { barLayout, pickLabels, plotArea, tooltipPosition } from './geometry';

  /**
   * Barre divergenti dello scarto dal target (SPEC § 5.7): partono da zero, fascia ±`band` %.
   * Fuori fascia la barra è tratteggiata con contorno giallo e ha il simbolo ▲ (sopra) o ▼ (sotto):
   * verde e giallo non bastano da soli a distinguere i due stati.
   */
  interface Props {
    items: readonly DivergingItem[];
    band: number;
    summary: string;
    selected?: number;
    height?: number;
    testid?: string;
  }

  let { items, band, summary, selected = $bindable(-1), height = 170, testid }: Props = $props();

  const uid = $props.id();
  let width = $state(318);
  let tipW = $state(120);
  const INSETS = { left: 34, right: 8, top: 16, bottom: 26 };

  const n = $derived(items.length);
  const si = $derived(selected < 0 || selected >= n ? n - 1 : selected);
  const plot = $derived(plotArea(width, height, INSETS));
  const scale = $derived(divergingScale(items.map((i) => i.pct)));
  const layout = $derived(barLayout(n, plot, 14));
  const centers = $derived(items.map((_, i) => layout.x(i) + layout.bar / 2));
  const labels = $derived(new Set(pickLabels(centers, 22)));
  const y = (v: number) => scaleY(scale, v, plot.top, plot.height);
  const zero = $derived(y(0));

  const top = (pct: number) => (pct >= 0 ? y(pct) : zero);
  const size = (pct: number) => Math.max(Math.abs(y(pct) - zero), 3);
  const tickText = (t: number) => (t > 0 ? `+${formatInt(t)}` : formatInt(t));

  const current = $derived(items[si]);
  // Il tooltip sta dalla parte opposta alla barra rispetto allo zero, così non la copre.
  const TIP_H = 58;
  const tipPos = $derived({
    left: tooltipPosition({ x: centers[si] ?? 0, y: 0 }, { width: tipW, height: TIP_H }, { width, height }).left,
    top: current && current.pct >= 0 ? Math.min(zero + 12, height - TIP_H) : Math.max(0, zero - 12 - TIP_H),
  });
  const live = $derived(current ? [current.tip.title, current.tip.value, current.tip.extra].filter(Boolean).join(', ') : '');
</script>

{#if n > 0}
  <div in:rise>
    <ChartFrame label={summary} xs={centers} selected={si} onselect={(i) => (selected = i)} {live} {height} bind:width tone="food" {testid}>
      <svg {width} {height} aria-hidden="true">
        <defs>
          <pattern id="{uid}-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" class="hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" class="hatch-line" />
          </pattern>
        </defs>
        <rect class="band" x={plot.left} y={y(band)} width={plot.width} height={y(-band) - y(band)} />
        <line class="band-edge" x1={plot.left} x2={plot.left + plot.width} y1={y(band)} y2={y(band)} />
        <line class="band-edge" x1={plot.left} x2={plot.left + plot.width} y1={y(-band)} y2={y(-band)} />
        {#each scale.ticks as t (t)}
          <line class="grid" class:zero={t === 0} x1={plot.left} x2={plot.left + plot.width} y1={y(t)} y2={y(t)} />
          <text class="tick" x={plot.left - 6} y={y(t) + 3.5} text-anchor="end">{tickText(t)}</text>
        {/each}
        {#each items as item, i (item.key)}
          {@const x = layout.x(i)}
          {#if i === si}
            <rect class="sel-ring" x={x - 3} y={top(item.pct) - 3} width={layout.bar + 6} height={size(item.pct) + 6} rx="4" />
          {/if}
          <rect
            class="bar"
            class:out={item.out}
            {x}
            y={top(item.pct)}
            width={layout.bar}
            height={size(item.pct)}
            rx="3"
            style:fill={item.out ? `url(#${uid}-hatch)` : undefined}
          />
          {#if item.out}
            <text class="glyph" x={x + layout.bar / 2} y={item.pct >= 0 ? top(item.pct) - 4 : top(item.pct) + size(item.pct) + 11} text-anchor="middle"
              >{item.pct > 0 ? '▲' : '▼'}</text
            >
          {/if}
          {#if labels.has(i)}
            <text class="date" class:on={i === si} x={centers[i]} y={height - 8} text-anchor="middle">{item.label}</text>
          {/if}
        {/each}
      </svg>
      {#if current}
        <div class="tip" style:left="{tipPos.left}px" style:top="{tipPos.top}px" bind:offsetWidth={tipW} data-testid="chart-tooltip">
          <span class="tip-date">{current.tip.title}</span>
          <span class="tip-value">{current.tip.value}</span>
          {#if current.tip.extra}<span class="tip-extra">{current.tip.extra}</span>{/if}
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

  .band {
    fill: var(--food-tint);
  }

  .band-edge {
    stroke: var(--food-edge);
    stroke-dasharray: 3 3;
  }

  .grid {
    stroke: var(--line);
  }

  .grid.zero {
    stroke: var(--line-strong);
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

  .bar {
    fill: var(--food);
  }

  .bar.out {
    stroke: var(--tip);
    stroke-width: 2;
  }

  .hatch-bg {
    fill: color-mix(in srgb, var(--tip) 12%, transparent);
  }

  .hatch-line {
    stroke: color-mix(in srgb, var(--tip) 70%, transparent);
    stroke-width: 2;
  }

  .glyph {
    font-size: 10px;
    fill: var(--tip);
  }

  .sel-ring {
    fill: none;
    stroke: var(--text);
    stroke-width: 2;
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
