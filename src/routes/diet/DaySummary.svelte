<script lang="ts">
  import Card from '../../lib/components/Card.svelte';
  import ProgressBar from '../../lib/components/ProgressBar.svelte';
  import ProgressRing from '../../lib/components/ProgressRing.svelte';
  import type { Tone } from '../../lib/components/types';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { TARGET_ORIGIN_LABELS } from '../../lib/diet/calc/targets';
  import { formatDecimal, formatInt } from '../../lib/diet/format';
  import type { DayView } from '../../lib/diet/view';

  interface Props {
    view: DayView;
    /** Il giorno mostrato è oggi: kcal mangiate / target. Altrimenti kcal del piano / target. */
    today: boolean;
    /** Giorno del calendario mostrato (può differire da `view.weekday` se oggi è scambiato). */
    calendarWeekday: number;
  }

  let { view, today, calendarWeekday }: Props = $props();

  const shown = $derived(today ? view.eatenTotals : view.plan);
  const targets = $derived(view.resolved?.targets ?? null);
  const partial = $derived(!shown.complete);

  const value = $derived(shown.total.kcal);
  /** Nessun valore noto: un trattino, non uno zero. */
  const unknown = $derived(partial && value === 0);
  const ringText = $derived(unknown ? '—' : (partial ? '≥' : '') + formatInt(value));
  // Didascalie corte: devono stare nel foro dell'anello ("target 1.900" non ci sta).
  const caption = $derived(targets ? `${today ? 'di' : 'su'} ${formatInt(targets.kcal)}` : 'target —');
  const ringLabel = $derived(
    (unknown ? 'kcal sconosciute' : `${partial ? 'almeno ' : ''}${formatInt(value)} kcal ${today ? 'mangiate' : 'nel piano'}`) +
      (targets ? ` su ${formatInt(targets.kcal)} di target` : ', target mancante'),
  );

  const MACROS: readonly { key: 'protein' | 'carbs' | 'fat'; label: string; tone: Tone }[] = [
    { key: 'protein', label: 'Proteine', tone: 'training' },
    { key: 'carbs', label: 'Carboidrati', tone: 'food' },
    { key: 'fat', label: 'Grassi', tone: 'progress' },
  ];

  const typeTone = $derived(view.typeTone === 'muted' ? 'muted' : view.typeTone);
  const dayFull = $derived(
    weekdayName(calendarWeekday) +
      (today ? ' · oggi' : ' · anteprima') +
      (view.weekday !== calendarWeekday ? ` · piano di ${weekdayName(view.weekday).toLowerCase()}` : ''),
  );
  const planLine = $derived.by(() => {
    const p = view.plan;
    if (!p.complete && p.total.kcal === 0) return 'PIANO — kcal · FIBRE — g';
    const fiberPrefix = p.complete && p.fiberMissing.length === 0 ? '' : '≥ ';
    return `PIANO ${p.complete ? '' : '≥ '}${formatInt(p.total.kcal)} kcal · FIBRE ${fiberPrefix}${formatDecimal(p.total.fiber)} g`;
  });
</script>

<Card tone="food" label="Riepilogo del giorno">
  <div class="head">
    <span class="type mono-label {typeTone}">{view.typeLabel}</span>
    <span class="when">{dayFull}</span>
  </div>
  <div class="main">
    <!-- Un solo anello, mai ricreato: al cambio giorno cambiano solo i valori. -->
    <ProgressRing
      {value}
      max={targets?.kcal ?? 0}
      label={ringLabel}
      text={ringText}
      {caption}
      tone="food"
      size={112}
      stroke={11}
      textSize={20}
    />
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
  <div class="foot mono">
    <span>{planLine}</span>
    <span class="origin">{view.resolved ? TARGET_ORIGIN_LABELS[view.resolved.origin] : 'TARGET: MANCANTE'}</span>
  </div>
  {#if partial}
    <p class="partial">
      {shown.missing.length === 1 ? 'Un alimento è' : `${shown.missing.length} alimenti sono`} senza valori nutrizionali: i totali
      sono parziali.
    </p>
  {/if}
</Card>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .type {
    font-size: 12px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .type.training {
    color: var(--training);
  }
  .type.progress {
    color: var(--progress);
  }

  .when {
    flex: none;
    font-size: 12px;
    color: var(--muted);
    text-align: right;
  }

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

  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    color: var(--muted);
  }

  .origin {
    white-space: nowrap;
  }

  .partial {
    margin: 0;
    font-size: 12px;
    color: var(--tip);
  }
</style>
