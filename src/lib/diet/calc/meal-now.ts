import type { DietMeal } from '../../data/schemas/diet-payload';

/** Pasto senza nome e senza alimenti (MyDiet li esporta così): non si mostra nella tab Piano. */
export function isEmptyMeal(meal: DietMeal): boolean {
  return meal.name === '' && meal.items.length === 0;
}

/** `HH:MM` → minuti dalla mezzanotte. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Orario da mostrare: `time` se c'è ("13:00"), altrimenti la finestra ("12:00–13:30"), altrimenti vuoto. */
export function mealTimeLabel(meal: DietMeal): string {
  if (meal.time) return meal.time;
  if (meal.window) return `${meal.window[0]}–${meal.window[1]}`;
  return '';
}

const DAY_END = 24 * 60;

/** Inizio del pasto in minuti: inizio della finestra, altrimenti `time`; `null` se non ha orari. */
export function mealStartMinutes(meal: DietMeal): number | null {
  if (meal.window) return toMinutes(meal.window[0]);
  if (meal.time) return toMinutes(meal.time);
  return null;
}

/** Intervallo `[inizio, fine)` del pasto: la finestra, oppure da `time` all'inizio del pasto successivo. */
function rangeOf(meal: DietMeal, next: readonly DietMeal[]): [number, number] | null {
  if (meal.window) return [toMinutes(meal.window[0]), toMinutes(meal.window[1])];
  if (!meal.time) return null;
  const start = toMinutes(meal.time);
  const following = next.map(mealStartMinutes).find((m): m is number => m !== null && m > start);
  return [start, following ?? DAY_END];
}

function contains([start, end]: [number, number], now: number): boolean {
  // Finestra a cavallo della mezzanotte (es. 22:30–00:30).
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

/**
 * Pasto del momento: il primo pasto non vuoto e non ancora mangiato il cui intervallo contiene `nowMinutes`.
 * `null` se nessuno (es. tra due finestre, o tutti mangiati).
 */
export function currentMealKey(
  meals: readonly DietMeal[],
  eaten: Readonly<Record<string, boolean>>,
  nowMinutes: number,
): string | null {
  const visible = meals.filter((meal) => !isEmptyMeal(meal));
  for (const [i, meal] of visible.entries()) {
    if (Object.hasOwn(eaten, meal.key) && eaten[meal.key]) continue;
    const range = rangeOf(meal, visible.slice(i + 1));
    if (range && contains(range, nowMinutes)) return meal.key;
  }
  return null;
}

/**
 * Prossimo pasto (riepilogo dell'allenamento): quello del momento, altrimenti il primo non vuoto
 * e non mangiato che inizia dopo `nowMinutes`. `null` se per oggi non ne restano.
 */
export function upcomingMealKey(
  meals: readonly DietMeal[],
  eaten: Readonly<Record<string, boolean>>,
  nowMinutes: number,
): string | null {
  const current = currentMealKey(meals, eaten, nowMinutes);
  if (current) return current;
  const later = meals
    .filter((meal) => !isEmptyMeal(meal) && !(Object.hasOwn(eaten, meal.key) && eaten[meal.key]))
    .map((meal) => ({ key: meal.key, start: mealStartMinutes(meal) }))
    .filter((m): m is { key: string; start: number } => m.start !== null && m.start > nowMinutes)
    .sort((a, b) => a.start - b.start);
  return later[0]?.key ?? null;
}
