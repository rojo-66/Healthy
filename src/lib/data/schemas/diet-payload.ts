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

/**
 * Variante di un giorno (2b, formato v3): i pasti, gli integratori e la nota per un tipo di giornata.
 * `type: null` solo se è l'unica variante del giorno e il tipo non è ancora noto (MyDiet, completamento guidato).
 */
export const variantSchema = z.object({
  /** Chiave in `dayTypes` (gym, run, rest…). */
  type: safeKey.nullable().default(null),
  note: text(MAX_TEXT.note).default(''),
  supplements: z.array(supplementSchema).max(MAX_ITEMS.supplementsPerDay).default([]),
  meals: z.array(mealSchema).max(MAX_ITEMS.mealsPerDay),
});

/**
 * Giorno della settimana del piano (2b): 1–3 varianti per tipo di giornata e il tipo predefinito
 * (quello del piano originale). Quale variante si segue in una data lo decide `resolveDietDay` (`diet/variants.ts`).
 */
export const daySchema = z.object({
  weekday,
  /** Tipo del piano originale per quel giorno; `null` se non è noto (lo si sceglie nel completamento guidato). */
  defaultType: safeKey.nullable().default(null),
  variants: z.array(variantSchema).min(1).max(MAX_ITEMS.variantsPerDay),
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
  /** Indicazioni del nutrizionista valide per tutti i giorni (aggiunte con il modello per Claude). */
  generalNotes: text(MAX_TEXT.long).default(''),
};

interface PayloadRefs {
  dayTypes: Record<string, unknown>;
  products: Record<string, unknown>;
  days: readonly {
    weekday: number;
    defaultType: string | null;
    variants: readonly {
      type: string | null;
      meals: readonly { key: string; label: string; recipe: number | null; items: readonly { p: string }[] }[];
    }[];
  }[];
  recipes: readonly { n: number }[];
}

/** Etichetta di un tipo per i messaggi: quella del piano, altrimenti la chiave. */
function typeLabel(dayTypes: Record<string, unknown>, key: string): string {
  const entry = Object.prototype.hasOwnProperty.call(dayTypes, key) ? dayTypes[key] : undefined;
  const label = entry && typeof entry === 'object' && 'label' in entry ? (entry as { label: unknown }).label : null;
  return typeof label === 'string' && label.trim() !== '' ? label.toLowerCase() : key;
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

    if (day.defaultType !== null && !has(plan.dayTypes, day.defaultType)) {
      issue(`${dayName}: il tipo di giornata «${day.defaultType}» non è tra i tipi di giornata`);
    }

    // Varianti (2b): tipi diversi, al massimo una senza tipo e solo se è l'unica, quella predefinita presente.
    const types = new Set<string>();
    for (const variant of day.variants) {
      if (variant.type === null) {
        if (day.variants.length > 1) issue(`${dayName}: più varianti, ma una non ha il tipo di giornata`);
        continue;
      }
      if (types.has(variant.type)) issue(`${dayName}: due varianti dello stesso tipo («${typeLabel(plan.dayTypes, variant.type)}»)`);
      types.add(variant.type);
      if (!has(plan.dayTypes, variant.type) && variant.type !== day.defaultType) {
        issue(`${dayName}: il tipo di giornata «${variant.type}» non è tra i tipi di giornata`);
      }
    }
    if (day.defaultType !== null && !types.has(day.defaultType)) {
      issue(`${dayName}: manca la variante del tipo predefinito (${typeLabel(plan.dayTypes, day.defaultType)})`);
    }
    if (day.defaultType === null && types.size > 0) {
      issue(`${dayName}: manca il tipo predefinito (defaultType) tra quelli delle varianti`);
    }

    for (const variant of day.variants) {
      const variantName = day.variants.length > 1 && variant.type !== null ? ` (${typeLabel(plan.dayTypes, variant.type)})` : '';
      const mealKeys = new Set<string>();
      for (const meal of variant.meals) {
        const where = `${dayName}${variantName} › ${meal.label}`;
        if (mealKeys.has(meal.key)) issue(`${dayName}${variantName}: il pasto «${meal.key}» compare due volte`);
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
}

export const dietPayloadSchema = z.object(dietPayloadShape).superRefine(checkDietReferences);

export type DietPayload = z.infer<typeof dietPayloadSchema>;
/** Giorno della settimana del piano, con le sue varianti (schema v3). */
export type DietPlanDay = z.infer<typeof daySchema>;
export type DietVariant = z.infer<typeof variantSchema>;
/**
 * Giorno "appiattito" (2b): la variante scelta per una data, nella forma che usano i calcoli (pasti, integratori,
 * nota e tipo). Lo produce `resolveDietDay` (`diet/variants.ts`); è la forma del giorno prima del formato v3.
 */
export interface DietDay {
  weekday: number;
  /** Tipo di giornata in vigore (decide i target); `null` se non è noto. */
  type: string | null;
  note: string;
  supplements: DietSupplement[];
  meals: DietMeal[];
}
export type DietMeal = z.infer<typeof mealSchema>;
export type DietProduct = z.infer<typeof productSchema>;
export type DietRecipe = z.infer<typeof recipeSchema>;
export type DietDayType = z.infer<typeof dayTypeSchema>;
export type DietTargets = z.infer<typeof targetsSchema>;
export type DietNutrients = z.infer<typeof nutrientsSchema>;
export type DietSupplement = z.infer<typeof supplementSchema>;
export type TargetsSource = z.infer<typeof targetsSourceSchema>;
