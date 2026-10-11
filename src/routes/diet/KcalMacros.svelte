<script lang="ts">
  import ProgressBar from '../../lib/components/ProgressBar.svelte';
  import ProgressRing from '../../lib/components/ProgressRing.svelte';
  import type { Tone } from '../../lib/components/types';
  import type { Totals } from '../../lib/diet/calc/nutrients';
  import type { DayTargets } from '../../lib/diet/calc/targets';
  import { formatInt } from '../../lib/diet/format';

  /** Anello kcal + barre P/C/G (Dieta e Home). Mai ricreato: al cambio giorno cambiano solo i valori. */
  interface Props {
    shown: Totals;
    targets: DayTargets | null;
    /** `eaten`: kcal mangiate / target ("di 1.800"); `plan`: kcal del piano / target ("su 1.800"). */
    mode: 'eaten' | 'plan';
    size?: number;
    stroke?: number;
    textSize?: number;
  }

  let { shown, targets, mode, size = 112, stroke = 11, textSize = 20 }: Props = $props();

  const partial = $derived(!shown.complete);
  const value = $derived(shown.total.kcal);
  /** Nessun valore noto: un trattino, non uno zero. */
  const unknown = $derived(partial && value === 0);
  const ringText = $derived(unknown ? '—' : (partial ? '≥' : '') + formatInt(value));
  // Didascalie corte: devono stare nel foro dell'anello ("target 1.900" non ci sta).
  const caption = $derived(targets ? `${mode === 'eaten' ? 'di' : 'su'} ${formatInt(targets.kcal)}` : 'target —');
  const ringLabel = $derived(
    (unknown
      ? 'kcal sconosciute'
      : `${partial ? 'almeno ' : ''}${formatInt(value)} kcal ${mode === 'eaten' ? 'mangiate' : 'nel piano'}`) +
      (targets ? ` su ${formatInt(targets.kcal)} di target` : ', target mancante'),
  );

  const MACROS: readonly { key: 'protein' | 'carbs' | 'fat'; label: string; tone: Tone }[] = [
    { key: 'protein', label: 'Proteine', tone: 'training' },
    { key: 'carbs', label: 'Carboidrati', tone: 'food' },
    { key: 'fat', label: 'Grassi', tone: 'progress' },
  ];
</script>

<div class="main">
  <ProgressRing {value} max={targets?.kcal ?? 0} label={ringLabel} text={ringText} {caption} tone="food" {size} {stroke} {textSize} />
  <div class="macros">
    {#each MACROS as m (m.key)}
      {@const v = shown.total[m.key]}
      {@const t = targets?.[m.key] ?? null}
      <div class="macro">
        <div class="macro-row">
          <span>{m.label}</span>
          <span class="mono">{Math.round(v)}{t === null ? ' g' : ` / ${Math.round(t)} g`}</span>
        </div>
        <ProgressBar
          value={v}
          max={t ?? 0}
          label={m.label}
          valueText={t === null ? `${Math.round(v)} g, target mancante` : `${Math.round(v)} di ${Math.round(t)} g`}
          tone={m.tone}
          rounded
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .main {
    display: flex;
    gap: var(--space-5);
    align-items: center;
  }

  .macros {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .macro {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .macro-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: 12px;
  }
</style>
