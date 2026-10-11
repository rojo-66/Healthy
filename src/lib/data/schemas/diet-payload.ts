import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { hhmm, int, num, requiredText, safeKey, text, uniqueArray, weekday } from './common';

/**
 * Contenuto di un piano alimentare (SPEC § 8.2), senza la busta `app/kind/schemaVersion`.
 * Pensato anche per il file di MyDiet (§ 8.3, conversione in M3): categorie libere, pasti senza nome
 * e senza alimenti, valori nutrizionali e target facoltativi (li completa il completamento guidato).
 * I campi facoltativi hanno un valore predefinito: nel database il piano è sempre completo.
 */

export const WEEKDAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const;

/** Nome del giorno per i messaggi (1 = lunedì). */
export function weekdayName(day: number): string {
  return WEEKDAY_NAMES[day - 1] ?? `Giorno ${day}`;
}

/** Record con chiavi sicure e numero massimo di voci. */
function keyedRecord<T extends z.ZodType>(value: T, max: number, what: string) {
  return z
    .record(safeKey, value)
    .refine((record) => Object.keys(record).length <= max, `troppi ${what}: massimo ${max}`);
}

/** Valori per 100 g (o per pezzo, se `unit` è `pz` e c'è `pieceGrams`). */
export const nutrientsSchema = z.object({
  kcal: num(0, 1000),
  protein: num(0, 100),
  carbs: num(0, 100),
  fat: num(0, 100),
  fiber: num(0, 100).nullable().default(null),
});

/** Target del nutrizionista per un tipo di giornata: usati così come sono (§ 6.1). */
export const targetsSchema = z.object({
  kcal: num(0, 10000),
  protein: num(0, 1000).nullable().default(null),
  carbs: num(0, 2000).nullable().default(null),
  fat: num(0, 1000).nullable().default(null),
  fiber: num(0, 500).nullable().default(null),
});

/** Da dove vengono i target: dal file del piano (nutrizionista), inseriti a mano o stima accettata (§ 6.1). */
export const targetsSourceSchema = z.enum(['plan', 'manual', 'estimated']);

export const dayTypeSchema = z.object({
  label: requiredText(MAX_TEXT.short),
  targets: targetsSchema.nullable().default(null),
  /** Aggiunto in M3: i piani salvati prima valgono come "dal piano". */
  targetsSource: targetsSourceSchema.default('plan'),
});

export const productSchema = z.object({
  name: requiredText(MAX_TEXT.name),
  /** Categoria (reparto): libera, anche se non compare in `categories` (es. Integratori). */
  cat: text(MAX_TEXT.short).default(''),
  unit: z.enum(['g', 'pz', 'ml']),
  /** `false` = non va nella lista della spesa. */
  shop: z.boolean().default(true),
  per100: nutrientsSchema.nullable().default(null),
  pieceGrams: num(0, 5000).nullable().default(null),
});

export const supplementSchema = z.object({
  name: requiredText(MAX_TEXT.name),
  when: text(MAX_TEXT.short).default(''),
  dose: text(MAX_TEXT.short).default(''),
  skip: z.boolean().default(false),
});

export const mealItemSchema = z.object({
  /** Chiave del prodotto in `products`. */
  p: safeKey,
  q: num(0, 5000),
});

export const mealSchema = z.object({
  key: safeKey,
  label: requiredText(MAX_TEXT.short),
  time: hhmm.nullable().default(null),
  window: z.tuple([hhmm, hhmm]).nullable().default(null),
  /** Può essere vuoto (pasti senza nome in MyDiet). */
  name: text(MAX_TEXT.name).default(''),
  recipe: int(1, 9999).nullable().default(null),
  /** Può essere vuoto (pasto libero). */
  items: z.array(mealItemSchema).max(MAX_ITEMS.itemsPerMeal).default([]),
});

export const daySchema = z.object({
  weekday,
  /** Chiave in `dayTypes`; `null` se il piano non distingue i tipi di giornata. */
  type: safeKey.nullable().default(null),
  note: text(MAX_TEXT.note).default(''),
  supplements: z.array(supplementSchema).max(MAX_ITEMS.supplementsPerDay).default([]),
  meals: z.array(mealSchema).max(MAX_ITEMS.mealsPerDay),
});

export const recipeSchema = z.object({
  n: int(1, 9999),
  name: requiredText(MAX_TEXT.name),
  meta: text(MAX_TEXT.name).default(''),
  dose: text(MAX_TEXT.note).default(''),
  steps: z.array(text(MAX_TEXT.long)).max(MAX_ITEMS.recipeSteps).default([]),
  tip: text(MAX_TEXT.note).default(''),
});

/** Campi del piano: riusati dal record del database e dal file condiviso. */
export const dietPayloadShape = {
  dayTypes: keyedRecord(dayTypeSchema, MAX_ITEMS.dayTypes, 'tipi di giornata').default({}),
  categories: uniqueArray(requiredText(MAX_TEXT.short), MAX_ITEMS.categories, 'categorie ripetute').default([]),
  products: keyedRecord(productSchema, MAX_ITEMS.products, 'prodotti'),
  days: z.array(daySchema).min(1).max(7),
  recipes: z.array(recipeSchema).max(MAX_ITEMS.recipes).default([]),
};

interface PayloadRefs {
  dayTypes: Record<string, unknown>;
  products: Record<string, unknown>;
  days: readonly {
    weekday: number;
    type: string | null;
    meals: readonly { key: string; label: string; recipe: number | null; items: readonly { p: string }[] }[];
  }[];
  recipes: readonly { n: number }[];
}

/** Riferimenti incrociati: prodotti, ricette e tipi di giornata citati devono esistere. */
export function checkDietReferences(plan: PayloadRefs, ctx: z.RefinementCtx): void {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', path: [], message });
  const has = (record: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(record, key);
  const recipeNumbers = new Set<number>();

  for (const recipe of plan.recipes) {
    if (recipeNumbers.has(recipe.n)) issue(`Ricette: il numero ${recipe.n} è usato due volte`);
    recipeNumbers.add(recipe.n);
  }

  const seenDays = new Set<number>();
  for (const day of plan.days) {
    const dayName = weekdayName(day.weekday);
    if (seenDays.has(day.weekday)) issue(`${dayName} compare due volte`);
    seenDays.add(day.weekday);

    if (day.type !== null && !has(plan.dayTypes, day.type)) {
      issue(`${dayName}: il tipo di giornata «${day.type}» non è tra i tipi di giornata`);
    }

    const mealKeys = new Set<string>();
    for (const meal of day.meals) {
      const where = `${dayName} › ${meal.label}`;
      if (mealKeys.has(meal.key)) issue(`${dayName}: il pasto «${meal.key}» compare due volte`);
      mealKeys.add(meal.key);
      if (meal.recipe !== null && !recipeNumbers.has(meal.recipe)) {
        issue(`${where}: la ricetta ${meal.recipe} non è tra le ricette`);
      }
      for (const item of meal.items) {
        if (!has(plan.products, item.p)) issue(`${where} usa il prodotto «${item.p}» che non è nell'elenco dei prodotti`);
      }
    }
  }
}

export const dietPayloadSchema = z.object(dietPayloadShape).superRefine(checkDietReferences);

export type DietPayload = z.infer<typeof dietPayloadSchema>;
export type DietDay = z.infer<typeof daySchema>;
export type DietMeal = z.infer<typeof mealSchema>;
export type DietProduct = z.infer<typeof productSchema>;
export type DietRecipe = z.infer<typeof recipeSchema>;
export type DietDayType = z.infer<typeof dayTypeSchema>;
export type DietTargets = z.infer<typeof targetsSchema>;
export type DietNutrients = z.infer<typeof nutrientsSchema>;
export type DietSupplement = z.infer<typeof supplementSchema>;
export type TargetsSource = z.infer<typeof targetsSourceSchema>;
