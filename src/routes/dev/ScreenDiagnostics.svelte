<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '../../lib/components/Card.svelte';
  import { viewport } from '../../lib/design/viewport.svelte';
  import { isStandalone } from '../../lib/pwa/standalone';

  // Diagnostica dello schermo (Rifinitura iPhone 1): per verificare sul telefono barra di navigazione e tastiera.
  interface Row {
    label: string;
    value: string;
  }

  let probe: HTMLDivElement;
  let rows = $state<Row[]>([]);

  function px(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : `${Math.round(n)} px`;
  }

  function read() {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const safe = probe ? getComputedStyle(probe) : null;
    const standalone = isStandalone(window);
    rows = [
      { label: 'innerHeight', value: px(window.innerHeight) },
      { label: 'visualViewport.height', value: px(vv?.height) },
      { label: 'visualViewport.offsetTop', value: px(vv?.offsetTop) },
      { label: 'visualViewport.scale', value: vv ? vv.scale.toFixed(2) : '—' },
      { label: 'clientHeight', value: px(root.clientHeight) },
      { label: '--app-h', value: root.style.getPropertyValue('--app-h') || '(CSS)' },
      { label: 'scrollY', value: px(window.scrollY) },
      { label: 'schermo', value: `${screen.width} × ${screen.height}` },
      {
        label: 'safe-area (su dx giù sx)',
        value: safe ? [safe.paddingTop, safe.paddingRight, safe.paddingBottom, safe.paddingLeft].map((v) => parseInt(v, 10) || 0).join(' · ') : '—',
      },
      { label: 'display-mode', value: standalone ? 'standalone' : 'browser' },
      { label: 'tastiera', value: viewport.keyboardOpen ? 'aperta' : 'chiusa' },
    ];
  }

  onMount(() => {
    read();
    const tick = setInterval(read, 500);
    return () => clearInterval(tick);
  });
</script>

<!-- Sonda: il browser risolve qui le safe area (env() non si legge da JS). -->
<div class="probe" bind:this={probe} aria-hidden="true"></div>

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

<style>
  .probe {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    visibility: hidden;
    pointer-events: none;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
      env(safe-area-inset-left, 0px);
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
