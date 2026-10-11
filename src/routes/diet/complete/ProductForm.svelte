<script lang="ts">
  import Button from '../../../lib/components/Button.svelte';
  import type { DietNutrients, DietProduct } from '../../../lib/data/schemas/diet-payload';
  import { numberToInput, parseNumberInput } from '../../../lib/diet/edit';
  import NumberField from './NumberField.svelte';

  interface Props {
    product: DietProduct;
    busy: boolean;
    /** Salva; restituisce gli errori (vuoto = salvato). */
    onsave: (per100: DietNutrients, pieceGrams: number | null) => Promise<readonly string[]>;
  }

  let { product, busy, onsave }: Props = $props();

  // I campi partono dai valori salvati e poi sono dell'utente (come un modulo).
  const initial = (() => product)();
  let kcal = $state(numberToInput(initial.per100?.kcal));
  let protein = $state(numberToInput(initial.per100?.protein));
  let carbs = $state(numberToInput(initial.per100?.carbs));
  let fat = $state(numberToInput(initial.per100?.fat));
  let fiber = $state(numberToInput(initial.per100?.fiber));
  let piece = $state(numberToInput(initial.pieceGrams));
  let errors = $state<readonly string[]>([]);

  const isPiece = $derived(product.unit === 'pz');

  async function save() {
    const fields = [
      ['kcal', kcal],
      ['proteine', protein],
      ['carboidrati', carbs],
      ['grassi', fat],
    ] as const;
    const problems: string[] = [];
    const values: number[] = [];
    for (const [name, text] of fields) {
      const n = parseNumberInput(text);
      if (n === null) problems.push(`${name}: campo obbligatorio`);
      else if (Number.isNaN(n)) problems.push(`${name}: «${text}» non è un numero`);
      else values.push(n);
    }
    const fiberValue = parseNumberInput(fiber);
    if (Number.isNaN(fiberValue)) problems.push(`fibre: «${fiber}» non è un numero`);
    const pieceValue = isPiece ? parseNumberInput(piece) : null;
    if (isPiece && pieceValue === null) problems.push('grammi per pezzo: campo obbligatorio');
    if (Number.isNaN(pieceValue)) problems.push(`grammi per pezzo: «${piece}» non è un numero`);
    if (problems.length > 0) {
      errors = problems;
      return;
    }
    const [k = 0, p = 0, c = 0, f = 0] = values;
    errors = await onsave({ kcal: k, protein: p, carbs: c, fat: f, fiber: fiberValue }, pieceValue);
  }
</script>

<div class="product" data-product={product.name}>
  <div class="head">
    <span class="name">{product.name}</span>
    <span class="unit mono-label">{product.cat || 'senza reparto'} · {isPiece ? 'a pezzi' : product.unit}</span>
  </div>
  {#if isPiece}
    <NumberField label="Grammi per pezzo" unit="g" bind:value={piece} />
  {/if}
  <p class="per">Valori per 100 {product.unit === 'ml' ? 'ml' : 'g'}</p>
  <div class="grid">
    <NumberField label="Kcal" unit="kcal" bind:value={kcal} />
    <NumberField label="Proteine" unit="g" bind:value={protein} />
    <NumberField label="Carboidrati" unit="g" bind:value={carbs} />
    <NumberField label="Grassi" unit="g" bind:value={fat} />
    <NumberField label="Fibre (facoltative)" unit="g" bind:value={fiber} />
  </div>
  {#if errors.length > 0}
    <ul class="errors" role="alert">
      {#each errors as e, i (i)}<li>{e}</li>{/each}
    </ul>
  {/if}
  <Button tone="food" variant="secondary" disabled={busy} label="Salva i valori di {product.name}" onclick={save}>Salva</Button>
</div>

<style>
  .product {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--surface);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .unit {
    font-size: 10px;
  }

  .per {
    margin: 0;
    font-size: 12px;
    color: var(--text-2);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .errors {
    margin: 0;
    padding-left: 1.2em;
    font-size: 13px;
    color: var(--tip);
  }
</style>
