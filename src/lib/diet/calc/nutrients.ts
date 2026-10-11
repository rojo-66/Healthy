import { lookup } from '../../data/errors';
import type { DietDay, DietMeal, DietPayload, DietProduct } from '../../data/schemas/diet-payload';

/** Kcal e macro (g). */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const ZERO_MACROS: Readonly<Macros> = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/** Perché un alimento non si può conteggiare. */
export type MissingReason = 'no-values' | 'no-piece-grams';

export type ItemNutrients =
  | { ok: true; value: Macros; /** `false` se il prodotto non ha le fibre. */ fiberKnown: boolean }
  | { ok: false; reason: MissingReason };

type Products = DietPayload['products'];

/**
 * Grammi di una quantità. `g` e `ml` valgono uguale (1 ml ≈ 1 g, scelta documentata in SPEC);
 * i pezzi servono `pieceGrams`, altrimenti `null`.
 */
export function itemGrams(product: DietProduct, quantity: number): number | null {
  if (product.unit !== 'pz') return quantity;
  return product.pieceGrams === null ? null : quantity * product.pieceGrams;
}

/** Valori di un alimento del pasto, da `per100` (e `pieceGrams` per i pezzi). Mai zero inventato. */
export function itemNutrients(product: DietProduct, quantity: number): ItemNutrients {
  const per100 = product.per100;
  if (per100 === null) return { ok: false, reason: 'no-values' };
  const grams = itemGrams(product, quantity);
  if (grams === null) return { ok: false, reason: 'no-piece-grams' };
  const f = grams / 100;
  return {
    ok: true,
    value: {
      kcal: per100.kcal * f,
      protein: per100.protein * f,
      carbs: per100.carbs * f,
      fat: per100.fat * f,
      fiber: (per100.fiber ?? 0) * f,
    },
    fiberKnown: per100.fiber !== null,
  };
}

/** `true` se il prodotto ha tutto ciò che serve per essere conteggiato. */
export function hasCompleteValues(product: DietProduct): boolean {
  return product.per100 !== null && (product.unit !== 'pz' || product.pieceGrams !== null);
}

/** Somma di alimenti: totale di quelli con valori + chi manca (mai conteggiato come zero in silenzio). */
export interface Totals {
  total: Macros;
  /** Chiavi dei prodotti senza valori (senza doppioni, in ordine di comparsa). */
  missing: string[];
  /** Chiavi dei prodotti conteggiati ma senza fibre. */
  fiberMissing: string[];
  /** Alimenti considerati (anche quelli senza valori). */
  itemCount: number;
  /** `true` se tutti gli alimenti hanno i valori. */
  complete: boolean;
}

function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

function pushUnique(list: string[], key: string): void {
  if (!list.includes(key)) list.push(key);
}

export function emptyTotals(): Totals {
  return { total: { ...ZERO_MACROS }, missing: [], fiberMissing: [], itemCount: 0, complete: true };
}

export function mealTotals(meal: DietMeal, products: Products): Totals {
  const totals = emptyTotals();
  for (const item of meal.items) {
    totals.itemCount++;
    const product = lookup(products, item.p);
    const result: ItemNutrients = product ? itemNutrients(product, item.q) : { ok: false, reason: 'no-values' };
    if (!result.ok) {
      pushUnique(totals.missing, item.p);
      continue;
    }
    totals.total = addMacros(totals.total, result.value);
    if (!result.fiberKnown) pushUnique(totals.fiberMissing, item.p);
  }
  totals.complete = totals.missing.length === 0;
  return totals;
}

export function sumTotals(list: readonly Totals[]): Totals {
  const sum = emptyTotals();
  for (const t of list) {
    sum.total = addMacros(sum.total, t.total);
    sum.itemCount += t.itemCount;
    t.missing.forEach((key) => pushUnique(sum.missing, key));
    t.fiberMissing.forEach((key) => pushUnique(sum.fiberMissing, key));
  }
  sum.complete = sum.missing.length === 0;
  return sum;
}

/** Totale di un giorno; con `onlyMeals` solo quei pasti (es. quelli già mangiati). */
export function dayTotals(day: DietDay, products: Products, onlyMeals?: (meal: DietMeal) => boolean): Totals {
  return sumTotals(day.meals.filter((meal) => !onlyMeals || onlyMeals(meal)).map((meal) => mealTotals(meal, products)));
}
