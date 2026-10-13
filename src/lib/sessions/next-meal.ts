import type { DietLogDay } from '../data/schemas/diet-log';
import type { DietPayload } from '../data/schemas/diet-payload';

import { buildDayView, type MealView } from '../diet/view';
import { upcomingMealKey } from '../diet/calc/meal-now';

export interface NextMeal {
  meal: MealView;
  /** È il pasto del momento (non uno più tardi). */
  isNow: boolean;
}

/**
 * Collegamento alla dieta nel riepilogo (SPEC § 5.4): il prossimo pasto di oggi dal piano attivo,
 * con la variante del tipo di giornata di oggi (`type`, 2c) e i pasti già segnati com'erano. `null` se non c'è.
 */
export function nextMeal(
  payload: DietPayload,
  calendarWeekday: number,
  log: Pick<DietLogDay, 'eaten' | 'mealsFrom'> & Partial<Pick<DietLogDay, 'mealSources'>> | undefined,
  nowMinutes: number,
  type?: string,
): NextMeal | null {
  const mealsFrom = log?.mealsFrom ?? null;
  const eaten = log?.eaten ?? {};
  const view = buildDayView(payload, calendarWeekday, { today: true, eaten, nowMinutes, mealsFrom, type, mealSources: log?.mealSources });
  if (!view) return null;
  const key = upcomingMealKey(view.day.meals, eaten, nowMinutes);
  if (!key) return null;
  const meal = view.meals.find((m) => m.key === key);
  return meal ? { meal, isNow: meal.isNow } : null;
}
