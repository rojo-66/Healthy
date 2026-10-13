import { db } from '../db';
import type { DietLogDay, MealsFrom } from '../schemas/diet-log';
import { createTableRepo } from './table-repo';

export const dietLogRepo = createTableRepo('dietLog');

/** Giorni del diario tra due date comprese (`AAAA-MM-GG`). */
export function dietLogBetween(from: string, to: string): Promise<DietLogDay[]> {
  return db.dietLog.where('date').between(from, to, true, true).toArray();
}

/**
 * Segna un pasto come mangiato (o no), creando il giorno se serve. `source` = giorno del piano e variante da cui arriva
 * il pasto in quel momento (2c): se poi il tipo di giornata cambia, il pasto segnato resta com'era.
 * Togliendo la spunta la fonte si dimentica.
 */
export function setMealEaten(
  date: string,
  planId: string,
  mealKey: string,
  eaten: boolean,
  source: MealsFrom | null = null,
): Promise<DietLogDay> {
  return db.transaction('rw', db.dietLog, async () => {
    const day = (await db.dietLog.get(date)) ?? { date, planId, mealsFrom: null, eaten: {}, mealSources: {} };
    const mealSources = Object.fromEntries(Object.entries(day.mealSources ?? {}).filter(([key]) => key !== mealKey));
    if (eaten && source) mealSources[mealKey] = { weekday: source.weekday, type: source.type };
    return dietLogRepo.put({ ...day, planId, eaten: { ...day.eaten, [mealKey]: eaten }, mealSources });
  });
}

/** Il diario di un giorno, se c'è. */
export function getDietLogDay(date: string): Promise<DietLogDay | undefined> {
  return db.dietLog.get(date);
}
