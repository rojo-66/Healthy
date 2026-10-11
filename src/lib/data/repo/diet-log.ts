import { db } from '../db';
import type { DietLogDay } from '../schemas/diet-log';
import { createTableRepo } from './table-repo';

export const dietLogRepo = createTableRepo('dietLog');

/** Giorni del diario tra due date comprese (`AAAA-MM-GG`). */
export function dietLogBetween(from: string, to: string): Promise<DietLogDay[]> {
  return db.dietLog.where('date').between(from, to, true, true).toArray();
}

/** Segna un pasto come mangiato (o no), creando il giorno se serve. */
export function setMealEaten(date: string, planId: string, mealKey: string, eaten: boolean): Promise<DietLogDay> {
  return db.transaction('rw', db.dietLog, async () => {
    const day = (await db.dietLog.get(date)) ?? { date, planId, swappedFromWeekday: null, eaten: {} };
    return dietLogRepo.put({ ...day, planId, eaten: { ...day.eaten, [mealKey]: eaten } });
  });
}
