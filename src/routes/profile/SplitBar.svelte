<script lang="ts">
  import { onMount } from 'svelte';
  import { formatDecimal } from '../../lib/diet/format';

  // Barra FFM/FM: la parte magra (ciano) si riempie con translateX sopra il fondo FM (--data-alt).
  interface Props {
    ffm: number;
    fm: number;
  }

  let { ffm, fm }: Props = $props();

  let ready = $state(false);
  onMount(() => {
    requestAnimationFrame(() => (ready = true));
  });

  const ffmText = $derived(formatDecimal(ffm, 1));
  const fmText = $derived(formatDecimal(fm, 1));
</script>

<div class="wrap">
  <div class="track" role="img" aria-label="Massa magra {ffmText} per cento, massa grassa {fmText} per cento" data-testid="split-bar">
    <div class="fill bar" style:transform="translateX({((ready ? ffm : 0) - 100)}%)"></div>
  </div>
  <div class="legend">
    <span><b class="sq ffm" aria-hidden="true">■</b> Magra FFM {ffmText} %</span>
    <span><b class="sq fm" aria-hidden="true">■</b> Grassa FM {fmText} %</span>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .track {
    position: relative;
    height: 14px;
    overflow: hidden;
    background: var(--data-alt);
  }

  .fill {
    position: absolute;
    inset: 0;
    background: var(--progress);
  }

  .legend {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: 12px;
    color: var(--muted);
  }

  .sq.ffm {
    color: var(--progress);
  }
  .sq.fm {
    color: var(--data-alt);
  }
</style>
