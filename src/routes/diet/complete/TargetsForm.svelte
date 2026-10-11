<script lang="ts">
  import Button from '../../../lib/components/Button.svelte';
  import type { DietDayType, DietTargets, TargetsSource } from '../../../lib/data/schemas/diet-payload';
  import type { KcalEstimate } from '../../../lib/diet/calc/estimate';
  import { TARGET_ORIGIN_LABELS } from '../../../lib/diet/calc/targets';
  import { numberToInput, parseNumberInput } from '../../../lib/diet/edit';
  import { formatInt } from '../../../lib/diet/format';
  import NumberField from './NumberField.svelte';

  interface Props {
    dayType: DietDayType;
    /** Stima per questo tipo di giornata, o il motivo per cui non c'è. */
    estimate: { ok: true; value: KcalEstimate } | { ok: false; reason: string };
    busy: boolean;
    onsave: (targets: DietTargets, source: Exclude<TargetsSource, 'plan'>) => Promise<readonly string[]>;
  }

  let { dayType, estimate, busy, onsave }: Props = $props();

  // Target del nutrizionista: usati così come sono, mai modificati (§ 6.1).
  const locked = $derived(dayType.targetsSource === 'plan' && dayType.targets !== null);

  const initial = (() => dayType.targets)();
  let kcal = $state(numberToInput(initial?.kcal));
  let protein = $state(numberToInput(initial?.protein));
  let carbs = $state(numberToInput(initial?.carbs));
  let fat = $state(numberToInput(initial?.fat));
  let fiber = $state(numberToInput(initial?.fiber));
  /** Kcal messe dalla stima: se l'utente le cambia, i target diventano "inseriti a mano". */
  let estimatedKcal = $state<string | null>((() => (dayType.targetsSource === 'estimated' ? numberToInput(dayType.targets?.kcal) : null))());
  let errors = $state<readonly string[]>([]);

  function useEstimate() {
    if (!estimate.ok) return;
    kcal = numberToInput(estimate.value.kcal);
    estimatedKcal = kcal;
  }

  async function save() {
    const problems: string[] = [];
    const read = (name: string, text: string, required: boolean): number | null => {
      const n = parseNumberInput(text);
      if (n === null && required) problems.push(`${name}: campo obbligatorio`);
      if (Number.isNaN(n)) problems.push(`${name}: «${text}» non è un numero`);
      return n;
    };
    const k = read('kcal', kcal, true);
    const targets = {
      kcal: k ?? 0,
      protein: read('proteine', protein, false),
      carbs: read('carboidrati', carbs, false),
      fat: read('grassi', fat, false),
      fiber: read('fibre', fiber, false),
    };
    if (problems.length > 0) {
      errors = problems;
      return;
    }
    const source = estimatedKcal !== null && estimatedKcal === kcal ? 'estimated' : 'manual';
    errors = await onsave(targets, source);
  }
</script>

<div class="targets" data-day-type={dayType.label}>
  <div class="head">
    <span class="name">{dayType.label}</span>
    {#if dayType.targets}
      <span class="mono-label origin">{TARGET_ORIGIN_LABELS[dayType.targetsSource === 'plan' ? 'nutritionist' : dayType.targetsSource]}</span>
    {/if}
  </div>

  {#if locked && dayType.targets}
    <p class="locked">
      {formatInt(dayType.targets.kcal)} kcal{dayType.targets.protein !== null ? ` · P ${dayType.targets.protein} g` : ''}{dayType.targets
        .carbs !== null
        ? ` · C ${dayType.targets.carbs} g`
        : ''}{dayType.targets.fat !== null ? ` · G ${dayType.targets.fat} g` : ''}
    </p>
    <p class="hint">Target del nutrizionista: l'app li usa così come sono.</p>
  {:else}
    <div class="grid">
      <NumberField label="Kcal" unit="kcal" bind:value={kcal} />
      <NumberField label="Proteine" unit="g" bind:value={protein} />
      <NumberField label="Carboidrati" unit="g" bind:value={carbs} />
      <NumberField label="Grassi" unit="g" bind:value={fat} />
      <NumberField label="Fibre" unit="g" bind:value={fiber} />
    </div>
    {#if estimate.ok}
      <Button variant="ghost" tone="food" disabled={busy} onclick={useEstimate}>
        Usa la stima: {formatInt(estimate.value.kcal)} kcal
      </Button>
      <p class="hint">
        Stima Mifflin-St Jeor (BMR {formatInt(estimate.value.bmr)} × {String(estimate.value.factor).replace('.', ',')}), solo
        kcal: i macro restano da inserire.
      </p>
      {#each estimate.value.warnings as w, i (i)}<p class="warn">{w}</p>{/each}
    {:else}
      <p class="hint">{estimate.reason}</p>
    {/if}
    {#if errors.length > 0}
      <ul class="errors" role="alert">
        {#each errors as e, i (i)}<li>{e}</li>{/each}
      </ul>
    {/if}
    <Button tone="food" variant="secondary" disabled={busy} label="Salva i target di {dayType.label}" onclick={save}>
      Salva target
    </Button>
  {/if}
</div>

<style>
  .targets {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--surface);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
  }

  .name {
    font-weight: 700;
  }

  .origin {
    font-size: 10px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .locked {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 14px;
  }

  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .warn,
  .errors {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }

  .errors {
    padding-left: 1.2em;
  }
</style>
