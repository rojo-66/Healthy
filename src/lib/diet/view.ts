import { lookup } from '../data/errors';
import type { MealsFrom } from '../data/schemas/diet-log';
import type { DietDay, DietMeal, DietPayload, DietSupplement } from '../data/schemas/diet-payload';
import { WEEKDAY_INITIALS } from './calc/calendar';
import { currentMealKey, isEmptyMeal, mealStartMinutes, mealTimeLabel } from './calc/meal-now';
import { dayTotals, mealTotals, type Totals } from './calc/nutrients';
import { dayObservations, type Observation } from './calc/observations';
import { resolveTargets, type ResolvedTargets } from './calc/targets';
import { formatQuantity } from './format';
import { resolveDietDay, type ResolvedDietDay, type VariantFallback, type VariantRequest } from './variants';

/**
 * Cosa mostra la tab Piano per un giorno: tutto calcolato qui (funzioni pure, testate),
 * i componenti si limitano a disegnare.
 */

/** Colore del rombo del tipo di giornata: magenta palestra, ciano corsa, grigio riposo e altri. */
export type DayTypeTone = 'training' | 'progress' | 'muted';

export function dayTypeTone(typeKey: string | null): DayTypeTone {
  if (typeKey === 'gym') return 'training';
  if (typeKey === 'run') return 'progress';
  return 'muted';
}

export interface MealItemView {
  name: string;
  quantity: string;
  /** Alimento senza valori nutrizionali. */
  missing: boolean;
}

export interface MealView {
  key: string;
  label: string;
  time: string;
  /** Nome del pasto, o l'etichetta se il nome è vuoto. */
  name: string;
  items: MealItemView[];
  totals: Totals;
  /** Numero della ricetta, solo se la ricetta esiste nel piano. */
  recipe: number | null;
  isNow: boolean;
  eaten: boolean;
}

export interface DayView {
  weekday: number;
  day: DietDay;
  typeKey: string | null;
  typeLabel: string;
  typeTone: DayTypeTone;
  plan: Totals;
  /** Solo i pasti mangiati (ha senso solo per oggi). */
  eatenTotals: Totals;
  resolved: ResolvedTargets | null;
  observations: Observation[];
  meals: MealView[];
  supplements: DietSupplement[];
  note: string;
  /** Tipi delle varianti del giorno (2b): più di uno → chip delle varianti nella Dieta. */
  variantTypes: (string | null)[];
  /** Tipo predefinito del giorno (quello del piano originale). */
  defaultType: string | null;
  /** Ripiego usato per scegliere la variante (2b). */
  fallback: VariantFallback;
  /** Giorno da cui arrivano davvero i pasti (diverso dal giorno con lo scambio o con il ripiego). */
  sourceWeekday: number;
  /** Tipo della variante da cui arrivano davvero i pasti (2c: si salva con la spunta). */
  sourceType: string | null;
}

export interface DayViewOptions extends VariantRequest {
  /** Il giorno mostrato è oggi (spunte e pasto attuale). */
  today: boolean;
  eaten: Readonly<Record<string, boolean>>;
  nowMinutes: number;
  /**
   * Usa le spunte anche se il giorno non è oggi (Home, giorni passati: si vede cosa era stato segnato,
   * in sola lettura e senza "adesso").
   */
  keepEaten?: boolean;
  /**
   * Fonte di ogni pasto spuntato (2c, `dietLog.mealSources`): un pasto segnato quando il giorno seguiva un'altra
   * variante resta com'era; gli altri seguono la variante di adesso.
   */
  mealSources?: Readonly<Record<string, MealsFrom>>;
}

const isEaten = (eaten: Readonly<Record<string, boolean>>, key: string) => Object.hasOwn(eaten, key) && eaten[key] === true;

/**
 * Giorno appiattito (la variante da seguire) di un giorno della settimana; senza `request` la variante predefinita.
 * `undefined` se il giorno non è nel piano.
 */
export function findDay(payload: DietPayload, weekday: number, request: VariantRequest = {}): ResolvedDietDay | undefined {
  return resolveDietDay(payload, weekday, request) ?? undefined;
}

const sameSource = (a: { weekday: number; type: string | null }, b: { weekday: number; type: string | null }) =>
  a.weekday === b.weekday && a.type === b.type;

/**
 * Pasti del giorno con quelli già spuntati com'erano quando sono stati segnati (2c): se la fonte di un pasto spuntato
 * è diversa da quella di adesso, si prende il pasto della sua fonte (stessa chiave), al suo posto o, se la variante
 * di adesso non ha quel pasto, in ordine di orario. Senza differenze restituisce lo stesso giorno.
 */
export function withEatenMeals(
  payload: DietPayload,
  day: ResolvedDietDay,
  eaten: Readonly<Record<string, boolean>>,
  sources: Readonly<Record<string, MealsFrom>> | undefined,
): ResolvedDietDay {
  if (!sources) return day;
  const replaced = new Map<string, DietMeal>();
  for (const [key, source] of Object.entries(sources)) {
    if (!isEaten(eaten, key)) continue;
    const from = resolveDietDay(payload, source.weekday, { mealsFrom: source });
    if (!from || sameSource(from.source, day.source)) continue;
    const meal = from.meals.find((m) => m.key === key);
    if (meal) replaced.set(key, meal);
  }
  if (replaced.size === 0) return day;
  const meals = day.meals.map((m) => replaced.get(m.key) ?? m);
  for (const [key, meal] of replaced) {
    if (day.meals.some((m) => m.key === key)) continue;
    const start = mealStartMinutes(meal);
    const at = start === null ? -1 : meals.findIndex((m) => (mealStartMinutes(m) ?? -1) > start);
    if (at === -1) meals.push(meal);
    else meals.splice(at, 0, meal);
  }
  return { ...day, meals };
}

export function buildDayView(payload: DietPayload, weekday: number, options: DayViewOptions): DayView | null {
  const resolvedDay = findDay(payload, weekday, { type: options.type, mealsFrom: options.mealsFrom });
  if (!resolvedDay) return null;
  const { products } = payload;
  const eaten = options.today || options.keepEaten ? options.eaten : {};
  const day = withEatenMeals(payload, resolvedDay, eaten, options.mealSources);
  const plan = dayTotals(day, products);
  const resolved = resolveTargets(payload, day, plan);
  const nowKey = options.today ? currentMealKey(day.meals, eaten, options.nowMinutes) : null;
  const recipes = new Set(payload.recipes.map((r) => r.n));
  const dayType = day.type === null ? undefined : lookup(payload.dayTypes, day.type);

  const meals = day.meals
    .filter((meal) => !isEmptyMeal(meal))
    .map((meal): MealView => {
      const totals = mealTotals(meal, products);
      return {
        key: meal.key,
        label: meal.label,
        time: mealTimeLabel(meal),
        name: meal.name || meal.label,
        items: meal.items.map((item) => {
          const product = lookup(products, item.p);
          return {
            name: product?.name ?? item.p,
            quantity: product ? formatQuantity(product.unit, item.q) : String(item.q),
            missing: totals.missing.includes(item.p),
          };
        }),
        totals,
        recipe: meal.recipe !== null && recipes.has(meal.recipe) ? meal.recipe : null,
        isNow: meal.key === nowKey,
        eaten: isEaten(eaten, meal.key),
      };
    });

  return {
    weekday: day.weekday,
    day,
    typeKey: day.type,
    typeLabel: dayType?.label ?? 'Senza tipo',
    typeTone: dayTypeTone(day.type),
    plan,
    eatenTotals: dayTotals(day, products, (meal) => isEaten(eaten, meal.key)),
    resolved,
    observations: dayObservations(payload, day, plan, resolved),
    meals,
    supplements: day.supplements,
    note: day.note,
    variantTypes: day.variantTypes,
    defaultType: day.defaultType,
    fallback: day.fallback,
    sourceWeekday: day.source.weekday,
    sourceType: day.source.type,
  };
}

export interface StripDay {
  weekday: number;
  initial: string;
  /** Kcal del piano (solo degli alimenti con valori), `null` se il giorno non è nel piano o non ha valori. */
  kcal: number | null;
  complete: boolean;
  typeTone: DayTypeTone;
  inPlan: boolean;
}

/**
 * Striscia dei 7 giorni: la variante in uso di ciascuno. `requests` = tipo di giornata (2c) e fonte dei pasti di ogni
 * giorno della settimana (indice 0 = lunedì); senza, la variante predefinita.
 */
export function weekStrip(payload: DietPayload, requests: readonly (VariantRequest | undefined)[] = []): StripDay[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const day = findDay(payload, weekday, requests[weekday - 1] ?? {});
    if (!day) return { weekday, initial: WEEKDAY_INITIALS[weekday - 1] ?? '', kcal: null, complete: false, typeTone: 'muted', inPlan: false };
    const totals = dayTotals(day, payload.products);
    const known = totals.complete ? totals.itemCount > 0 : totals.total.kcal > 0;
    return {
      weekday,
      initial: WEEKDAY_INITIALS[weekday - 1] ?? '',
      kcal: known ? totals.total.kcal : null,
      complete: totals.complete,
      typeTone: dayTypeTone(day.type),
      inPlan: true,
    };
  });
}
