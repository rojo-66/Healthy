<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import SegmentBar from './SegmentBar.svelte';
  import type { Segment } from './segments';
  import { formatClock } from './time';
  import { titleFontSize } from './title-fit';
  import type { Tone } from './types';

  interface Props {
    title: string;
    /** h1 nelle schermate; h2 dove la pagina ha già un h1 (pagina di prova). */
    level?: 'h1' | 'h2';
    tone?: Tone;
    /** Indietro: link o callback. */
    backHref?: string;
    onback?: () => void;
    backLabel?: string;
    /** Tempo trascorso in secondi (null = non mostrato). */
    elapsed?: number | null;
    /** Barra di avanzamento a segmenti (uno per esercizio). */
    segments?: readonly Segment[];
    current?: number;
    progressLabel?: string;
    /** Righe aggiuntive sotto il titolo (es. data e orario nel Riepilogo). */
    children?: Snippet;
  }

  let {
    title,
    level = 'h1',
    tone = 'training',
    backHref,
    onback,
    backLabel = 'Indietro',
    elapsed = null,
    segments,
    current,
    progressLabel,
    children,
  }: Props = $props();

  // Lo spazio reale del titolo (tolti freccia e tempo) decide la dimensione del font.
  let titleWidth = $state(0);
  const fontSize = $derived(titleFontSize(title, titleWidth || 270));
  const clock = $derived(elapsed === null ? '' : formatClock(elapsed));
</script>

<header class="banner tone-{tone}">
  <div class="row">
    {#if backHref}
      <a class="back tap" href={backHref} aria-label={backLabel}><Icon name="back" stroke={1.6} /></a>
    {:else}
      <button type="button" class="back tap" aria-label={backLabel} onclick={onback}>
        <Icon name="back" stroke={1.6} />
      </button>
    {/if}
    <svelte:element this={level} class="title" bind:clientWidth={titleWidth} style:font-size="{fontSize}px" {title}>
      {title}
    </svelte:element>
    {#if elapsed !== null}
      <span class="clock mono" role="timer" aria-label="Tempo trascorso {clock}">{clock}</span>
    {/if}
  </div>

  {#if segments?.length}
    <div class="progress">
      <div class="bar-wrap">
        <SegmentBar {segments} {current} {tone} label={progressLabel ?? ''} />
      </div>
      {#if current !== undefined}
        <span class="count mono" aria-hidden="true">{current + 1}/{segments.length}</span>
      {/if}
    </div>
  {/if}

  {@render children?.()}
</header>

<style>
  .banner {
    flex: none;
    position: relative;
    z-index: var(--z-banner);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: calc(var(--safe-top) + var(--space-2)) calc(var(--space-5) + var(--safe-right)) var(--space-3)
      calc(var(--space-2) + var(--safe-left));
    background: rgba(18, 20, 26, 0.96);
    border-bottom: 1px solid var(--line);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--touch);
  }

  /* Freccia sottile, senza sfondo. */
  .back {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
  }

  /* Sempre su una riga: si rimpicciolisce (16–32 px), poi ellissi. */
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    line-height: 1.2;
    /* Spazio per il bagliore: overflow: hidden (per l'ellissi) lo taglierebbe a rettangolo. */
    padding: 8px 4px;
    margin: -8px 0;
    color: var(--tone);
    text-shadow: 0 0 8px var(--tone-glow);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .clock {
    flex: none;
    font-size: 14px;
    font-weight: 700;
    color: var(--tone);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-left: 10px;
  }

  .bar-wrap {
    flex: 1;
    min-width: 0;
  }

  .count {
    font-size: 12px;
    color: var(--muted);
  }
</style>
