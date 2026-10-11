<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { Tone } from './types';

  interface Props {
    tone?: Tone;
    onprev?: () => void;
    onnext?: () => void;
    prevDisabled?: boolean;
    nextDisabled?: boolean;
    prevLabel?: string;
    nextLabel?: string;
    /** Contenuto del semicerchio (in sessione: il cerchio del recupero da 96 px). */
    center?: Snippet;
  }

  let {
    tone = 'training',
    onprev,
    onnext,
    prevDisabled = false,
    nextDisabled = false,
    prevLabel = 'Precedente',
    nextLabel = 'Successivo',
    center,
  }: Props = $props();

  // Sagoma: rettangolo con semicerchio centrale (dal mockup: r 54, corda 101,8 px sul bordo a y = 40).
  const H = 124;
  const TOP = 40;
  const HALF_CHORD = 50.9;
  const R = 54;
  let width = $state(390);
  const cx = $derived(width / 2);
  const edge = $derived(`M0 ${TOP} H${cx - HALF_CHORD} A${R} ${R} 0 0 1 ${cx + HALF_CHORD} ${TOP} H${width}`);
</script>

<footer class="footer tone-{tone}" bind:clientWidth={width}>
  <svg class="shape" width={width} height={H} viewBox="0 0 {width} {H}" aria-hidden="true">
    <path d="{edge} V{H} H0 Z" fill="var(--surface)" />
    <path d={edge} fill="none" stroke="var(--tone-edge)" stroke-width="1.2" />
  </svg>

  <button type="button" class="arrow prev tap" aria-label={prevLabel} disabled={prevDisabled} onclick={onprev}>
    <Icon name="back" size={26} stroke={1.8} />
    <span class="mono">PREC</span>
  </button>

  {#if center}
    <div class="center">{@render center()}</div>
  {/if}

  <button type="button" class="arrow next tap" aria-label={nextLabel} disabled={nextDisabled} onclick={onnext}>
    <Icon name="forward" size={26} stroke={1.8} />
    <span class="mono">SUCC</span>
  </button>
</footer>

<style>
  /* Le zone trasparenti sopra la sagoma lasciano passare i tocchi al contenuto sotto. */
  .footer {
    position: relative;
    flex: none;
    height: calc(124px + var(--safe-bottom));
    z-index: var(--z-banner);
    pointer-events: none;
    /* Sotto la sagoma (zona della home indicator) continua il colore della superficie. */
    background: linear-gradient(transparent 124px, var(--surface) 124px);
  }

  .shape {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
  }

  .arrow,
  .center {
    pointer-events: auto;
  }

  .arrow {
    position: absolute;
    top: 54px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 64px;
    height: 56px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
  }

  .arrow .mono {
    font-size: 10px;
    letter-spacing: 1px;
  }

  .prev {
    left: calc(22px + var(--safe-left));
  }

  .next {
    right: calc(22px + var(--safe-right));
  }

  .arrow:disabled {
    opacity: 0.3;
    cursor: default;
  }

  /* Centro del semicerchio: (larghezza/2, 58). */
  .center {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
  }
</style>
