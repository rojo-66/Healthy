<script lang="ts">
  import type { Snippet } from 'svelte';
  import { nearestIndex, type SeriesTone } from './geometry';
  import { nextPointIndex, scrub } from './scrub';

  /**
   * Contenitore interattivo comune dei grafici (SPEC § 5.7):
   * - tocco e trascinamento orizzontale scelgono il punto più vicino (`touch-action: pan-y`);
   *   lo swipe tra le tab non parte dal grafico (`data-swipe-ignore`);
   * - da tastiera frecce, Home e Fine tra i punti;
   * - il riassunto del grafico è l'etichetta, il punto scelto si annuncia con `aria-live="polite"`.
   */
  interface Props {
    /** Riassunto per lo screen reader, es. "Peso: da 87,5 a 88,9 kg dal 21/08 al 02/10". */
    label: string;
    /** Posizione orizzontale (px) di ogni punto o barra. */
    xs: readonly number[];
    /** Indice scelto, già risolto (mai -1). */
    selected: number;
    onselect: (index: number) => void;
    /** Testo del punto scelto, annunciato quando cambia. */
    live: string;
    height: number;
    width?: number;
    tone: SeriesTone;
    testid?: string;
    children: Snippet;
  }

  let { label, xs, selected, onselect, live, height, width = $bindable(318), tone, testid, children }: Props = $props();

  function pick(x: number) {
    const i = nearestIndex(xs, x);
    if (i >= 0 && i !== selected) onselect(i);
  }

  function onkeydown(e: KeyboardEvent) {
    const next = nextPointIndex(e.key, selected, xs.length);
    if (next === null) return;
    e.preventDefault();
    if (next !== selected) onselect(next);
  }
</script>

<div class="wrap tone-{tone}">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="frame"
    role="group"
    aria-roledescription="grafico"
    aria-label={label}
    tabindex="0"
    data-testid={testid}
    style:height="{height}px"
    bind:clientWidth={width}
    use:scrub={{ onpick: pick }}
    data-swipe-ignore
    {onkeydown}
  >
    {@render children()}
  </div>
  <p class="visually-hidden" aria-live="polite">{live}</p>
</div>

<style>
  .wrap {
    position: relative;
  }

  .frame {
    position: relative;
    width: 100%;
    touch-action: pan-y pinch-zoom;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    cursor: pointer;
  }

  .frame:focus-visible {
    outline: 2px solid var(--tone);
    outline-offset: 4px;
  }
</style>
