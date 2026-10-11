import { lookup } from '../data/errors';
import type { DietDay, DietPayload, DietSupplement } from '../data/schemas/diet-payload';
import { WEEKDAY_INITIALS } from './calc/calendar';
import { currentMealKey, isEmptyMeal, mealTimeLabel } from './calc/meal-now';
import { dayTotals, mealTotals, type Totals } from './calc/nutrients';
import { dayObservations, type Observation } from './calc/observations';
import { resolveTargets, type ResolvedTargets } from './calc/targets';
import { formatQuantity } from './format';

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
}

export interface DayViewOptions {
  /** Il giorno mostrato è oggi (spunte e pasto attuale). */
  today: boolean;
  eaten: Readonly<Record<string, boolean>>;
  nowMinutes: number;
}

const isEaten = (eaten: Readonly<Record<string, boolean>>, key: string) => Object.hasOwn(eaten, key) && eaten[key] === true;

export function findDay(payload: DietPayload, weekday: number): DietDay | undefined {
  return payload.days.find((d) => d.weekday === weekday);
}

export function buildDayView(payload: DietPayload, weekday: number, options: DayViewOptions): DayView | null {
  const day = findDay(payload, weekday);
  if (!day) return null;
  const { products } = payload;
  const eaten = options.today ? options.eaten : {};
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
    weekday,
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

/** Striscia dei 7 giorni. Per oggi, con uno scambio, si mostra il giorno seguito. */
export function weekStrip(payload: DietPayload, todayWeekday: number, todayFollows: number): StripDay[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const day = findDay(payload, weekday === todayWeekday ? todayFollows : weekday);
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
