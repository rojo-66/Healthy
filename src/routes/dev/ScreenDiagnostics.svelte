<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '../../lib/components/Card.svelte';
  import { viewport } from '../../lib/design/viewport.svelte';
  import { isStandalone } from '../../lib/pwa/standalone';

  // Diagnostica dello schermo: per verificare sul telefono barra di navigazione, pannelli e tastiera.
  interface Props {
    /** Riquadro compatto fisso sopra l'app (su tutte le schermate). */
    overlay?: boolean;
  }

  let { overlay = false }: Props = $props();

  interface Row {
    label: string;
    short: string;
    value: string;
  }

  let safeRaw: HTMLDivElement;
  let safeUsed: HTMLDivElement;
  let fixedBottom: HTMLDivElement;
  let rows = $state<Row[]>([]);

  function px(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : `${Math.round(n)}`;
  }

  function insets(el: HTMLElement | undefined): string {
    if (!el) return '—';
    const s = getComputedStyle(el);
    return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => parseInt(v, 10) || 0).join('·');
  }

  function read() {
    const vv = window.visualViewport;
    const root = document.documentElement;
    rows = [
      { label: 'innerHeight', short: 'inner', value: px(window.innerHeight) },
      { label: 'visualViewport.height', short: 'vv', value: px(vv?.height) },
      { label: 'visualViewport.offsetTop', short: 'vvTop', value: px(vv?.offsetTop) },
      { label: 'visualViewport.scale', short: 'scala', value: vv ? vv.scale.toFixed(2) : '—' },
      { label: 'screen.height', short: 'screen', value: px(screen.height) },
      { label: 'clientHeight', short: 'client', value: px(root.clientHeight) },
      { label: '--app-h', short: 'appH', value: root.style.getPropertyValue('--app-h').replace('px', '') || '(CSS)' },
      { label: 'scrollY', short: 'scrollY', value: px(window.scrollY) },
      // Dove finisce davvero un elemento `position: fixed; bottom: 0` (deve essere = innerHeight).
      { label: 'fondo di un elemento fisso', short: 'fixBot', value: px(fixedBottom?.getBoundingClientRect().bottom) },
      { label: 'safe-area grezza (su dx giù sx)', short: 'safe', value: insets(safeRaw) },
      { label: 'safe-area usata', short: 'usata', value: insets(safeUsed) },
      { label: 'display-mode', short: 'mode', value: isStandalone(window) ? 'standalone' : 'browser' },
      { label: 'tastiera', short: 'kb', value: viewport.keyboardOpen ? 'aperta' : 'chiusa' },
    ];
  }

  onMount(() => {
    read();
    const tick = setInterval(read, 500);
    return () => clearInterval(tick);
  });
</script>

<!-- Sonde: il browser risolve qui le safe area (env() non si legge da JS) e la posizione di un elemento fisso. -->
<div class="probe safe-raw" bind:this={safeRaw} aria-hidden="true"></div>
<div class="probe safe-used" bind:this={safeUsed} aria-hidden="true"></div>
<div class="probe fixed-bottom" bind:this={fixedBottom} aria-hidden="true"></div>

{#if overlay}
  <div class="overlay mono" aria-hidden="true" data-testid="diag-overlay">
    {#each rows as r (r.label)}<span><b>{r.short}</b> {r.value}</span>{/each}
  </div>
{:else}
  <Card tone="progress" label="Diagnostica dello schermo">
    <dl class="rows mono" data-testid="screen-diagnostics">
      {#each rows as r (r.label)}
        <div class="row">
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      {/each}
    </dl>
    <h3 class="mono-label events-title">Ultimi eventi</h3>
    <ol class="events mono">
      {#each viewport.events as e, i (i)}
        <li><span class="at">{e.at}</span> {e.name}</li>
      {:else}
        <li>—</li>
      {/each}
    </ol>
  </Card>
{/if}

<style>
  .probe {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .safe-raw {
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
      env(safe-area-inset-left, 0px);
  }

  .safe-used {
    padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
  }

  .fixed-bottom {
    top: auto;
    bottom: 0;
    height: 1px;
  }

  .overlay {
    position: fixed;
    top: calc(var(--safe-top) + 4px);
    left: calc(8px + var(--safe-left));
    right: calc(8px + var(--safe-right));
    z-index: calc(var(--z-toast) + 1);
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.82);
    border: 1px solid var(--tip);
    color: var(--text);
    font-size: 11px;
    line-height: 1.3;
    pointer-events: none;
  }

  .overlay b {
    color: var(--tip);
    font-weight: 500;
  }

  .rows {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: 13px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }

  dt {
    color: var(--text-2);
  }

  dd {
    margin: 0;
    color: var(--text);
    font-weight: 700;
    text-align: right;
  }

  .events-title {
    margin: var(--space-3) 0 0;
    font-size: 11px;
  }

  .events {
    margin: 0;
    padding-left: 1.4em;
    font-size: 12px;
    color: var(--text-2);
  }

  .at {
    color: var(--muted);
  }
</style>
