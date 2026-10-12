<script lang="ts">
  import { dayMonth } from '../profile/format';
  import { niceScale, scaleY } from '../progress/scale';
  import { markerIndexes, timeFractions, type Point } from '../progress/series';
  import { linePath, pickLabels, type SeriesTone } from './geometry';

  /**
   * Piccolo grafico con la sua scala (SPEC § 5.7, Composizione e Circonferenze): due o più punti con la
   * linea, l'ultimo pieno; con un punto solo il pallino senza linea. `next` aggiunge il punto tratteggiato
   * della prossima misura (data del Profilo) allo stesso livello dell'ultimo valore.
   * Non è interattivo: i valori esatti sono nella vista Tabella.
   */
  interface Props {
    points: readonly Point[];
    tone: SeriesTone;
    /** Riassunto per lo screen reader. */
    label: string;
    next?: string | null;
    height?: number;
    /** Date sotto il grafico (prima, ultima, prossima). */
    dates?: boolean;
    testid?: string;
  }

  let { points, tone, label, next = null, height = 52, dates = true, testid }: Props = $props();

  let width = $state(132);
  const PAD_X = 10;
  const PAD_Y = 8;

  const n = $derived(points.length);
  const scale = $derived(niceScale(points.map((p) => p.value)));
  const fractions = $derived(timeFractions([...points.map((p) => p.date), ...(next ? [next] : [])]));
  const xAt = (f: number) => PAD_X + f * Math.max(1, width - 2 * PAD_X);
  const xs = $derived(fractions.slice(0, n).map(xAt));
  const ys = $derived(points.map((p) => scaleY(scale, p.value, PAD_Y, height - 2 * PAD_Y)));
  const nextX = $derived(next && n > 0 ? xAt(fractions[n] ?? 1) : null);
  const lastY = $derived(ys[n - 1] ?? height / 2);
  const markers = $derived(markerIndexes(points, n - 1));
  const allXs = $derived(nextX === null ? xs : [...xs, nextX]);
  const allDates = $derived(next && n > 0 ? [...points.map((p) => p.date), next] : points.map((p) => p.date));
  const labelIdx = $derived(pickLabels(allXs, 34));
  const aria = $derived(next ? `${label}; prossima misura prevista il ${dayMonth(next)}` : label);
</script>

<div class="mini tone-{tone}" bind:clientWidth={width} data-testid={testid}>
  <svg {width} {height} role="img" aria-label={aria}>
    {#if nextX !== null}
      <path class="ghost" d="M {xs[n - 1]} {lastY} L {nextX} {lastY}" />
    {/if}
    {#if n > 1}
      <path class="line" d={linePath(xs, ys)} />
    {/if}
    {#each points as p, i (p.date + ':' + i)}
      {#if markers.has(i)}
        <circle class:last={i === n - 1} cx={xs[i]} cy={ys[i]} r={i === n - 1 ? 4.5 : 3.5} />
      {/if}
    {/each}
    {#if nextX !== null}
      <circle class="next" cx={nextX} cy={lastY} r="3.5" />
    {/if}
  </svg>
  {#if dates && n > 0}
    <div class="dates" aria-hidden="true">
      {#each labelIdx as i (i)}
        <span class:strong={i === n - 1} style:left="{allXs[i]}px">{dayMonth(allDates[i] ?? '')}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mini {
    width: 100%;
    min-width: 0;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .line {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .ghost {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 2;
    stroke-dasharray: 3 4;
    stroke-linecap: round;
  }

  circle {
    fill: var(--surface);
    stroke: var(--tone);
    stroke-width: 2;
  }

  circle.last {
    fill: var(--tone);
    stroke: var(--surface);
  }

  circle.next {
    fill: var(--surface);
    stroke: var(--line-strong);
    stroke-dasharray: 2 2;
  }

  .dates {
    position: relative;
    height: 14px;
  }

  .dates span {
    position: absolute;
    top: 0;
    width: 36px;
    margin-left: -18px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
  }

  .dates span.strong {
    color: var(--text);
    font-weight: 700;
  }
</style>
