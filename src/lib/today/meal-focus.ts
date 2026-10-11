import { currentMealKey, upcomingMealKey } from '../diet/calc/meal-now';
import type { DayView, MealView } from '../diet/view';

/** Il giorno mostrato rispetto a oggi. */
export type DayRelation = 'past' | 'today' | 'future';

/**
 * Card "pasto del momento" della Home:
 * - `now`: il pasto del momento (finestra o orario che contiene l'ora), anche se appena segnato;
 * - `next`: nessun pasto adesso (prima del primo, tra due finestre): il prossimo non ancora segnato;
 * - `preview` / `past`: altri giorni, sola lettura (il pasto che sarebbe "adesso" alla stessa ora);
 * - `finished`: oggi non restano pasti da fare;
 * - `no-meals`: il giorno ha solo pasti vuoti; `not-in-plan`: il giorno non è nel piano; `no-plan`: nessun piano.
 */
export type MealFocus =
  | { kind: 'meal'; mode: 'now' | 'next' | 'preview' | 'past'; meal: MealView }
  | { kind: 'finished'; eaten: number; total: number }
  | { kind: 'no-meals' }
  | { kind: 'not-in-plan' }
  | { kind: 'no-plan' };

/**
 * Sceglie il pasto con le stesse funzioni della Dieta (`currentMealKey`, `upcomingMealKey`), mai copiate.
 * `view` deve essere costruita con le spunte di quel giorno (oggi, o giorni passati con `keepEaten`).
 */
export function focusMeal(
  hasPlan: boolean,
  view: DayView | null,
  eaten: Readonly<Record<string, boolean>>,
  nowMinutes: number,
  relation: DayRelation,
): MealFocus {
  if (!hasPlan) return { kind: 'no-plan' };
  if (!view) return { kind: 'not-in-plan' };
  const meals = view.meals;
  if (meals.length === 0) return { kind: 'no-meals' };
  const byKey = (key: string | null) => (key === null ? undefined : meals.find((m) => m.key === key));

  if (relation === 'today') {
    const now = byKey(currentMealKey(view.day.meals, eaten, nowMinutes));
    if (now) return { kind: 'meal', mode: 'now', meal: now };
    // Pasto appena segnato: resta nella card ("✓ Mangiato", si può annullare) finché è ancora il pasto di quest'ora.
    const justEaten = byKey(currentMealKey(view.day.meals, {}, nowMinutes));
    if (justEaten?.eaten) return { kind: 'meal', mode: 'now', meal: justEaten };
    const next = byKey(upcomingMealKey(view.day.meals, eaten, nowMinutes));
    if (next) return { kind: 'meal', mode: 'next', meal: next };
    return { kind: 'finished', eaten: meals.filter((m) => m.eaten).length, total: meals.length };
  }

  // Altri giorni: il pasto di quell'ora, senza badare alle spunte; altrimenti il primo (domani) o l'ultimo (ieri).
  const sameHour = byKey(currentMealKey(view.day.meals, {}, nowMinutes) ?? upcomingMealKey(view.day.meals, {}, nowMinutes));
  const fallback = relation === 'future' ? meals[0] : meals[meals.length - 1];
  const meal = sameHour ?? fallback!;
  return { kind: 'meal', mode: relation === 'future' ? 'preview' : 'past', meal };
}
