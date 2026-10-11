import type { DietLogDay } from '../data/schemas/diet-log';
import type { DietPayload } from '../data/schemas/diet-payload';
import { effectiveWeekday } from '../diet/calc/calendar';
import { findDay, buildDayView, type MealView } from '../diet/view';
import { upcomingMealKey } from '../diet/calc/meal-now';

export interface NextMeal {
  meal: MealView;
  /** È il pasto del momento (non uno più tardi). */
  isNow: boolean;
}

/**
 * Collegamento alla dieta nel riepilogo (SPEC § 5.4): il prossimo pasto di oggi dal piano attivo,
 * tenendo conto di "oggi seguo il piano di un altro giorno". `null` se non c'è.
 */
export function nextMeal(
  payload: DietPayload,
  calendarWeekday: number,
  log: Pick<DietLogDay, 'eaten' | 'swappedFromWeekday'> | undefined,
  nowMinutes: number,
): NextMeal | null {
  const weekday = effectiveWeekday(calendarWeekday, log?.swappedFromWeekday);
  const day = findDay(payload, weekday);
  if (!day) return null;
  const eaten = log?.eaten ?? {};
  const key = upcomingMealKey(day.meals, eaten, nowMinutes);
  if (!key) return null;
  const view = buildDayView(payload, weekday, { today: true, eaten, nowMinutes });
  const meal = view?.meals.find((m) => m.key === key);
  return meal ? { meal, isNow: meal.isNow } : null;
}
