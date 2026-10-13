import { z } from 'zod';
import { entityId, isoDate, safeKey, weekday } from './common';

/**
 * Fonte dei pasti fissata per una data (2b, ex `swappedFromWeekday`): il giorno del piano (e la variante) da cui
 * prendere i pasti. `type: null` = la variante predefinita di quel giorno.
 */
export const mealsFromSchema = z.object({
  weekday,
  type: safeKey.nullable(),
});

/**
 * Diario della dieta: una riga per giorno (scostamento confermato da § 7, che aveva una riga per pasto).
 * Lo scambio "oggi seguo il piano di un altro giorno" è un dato del giorno, non del singolo pasto.
 */
export const dietLogSchema = z.object({
  date: isoDate,
  planId: entityId,
  /** Pasti di un altro giorno (scambio) o di un'altra variante; `null` = quelli del giorno. */
  mealsFrom: mealsFromSchema.nullable().default(null),
  /** Chiave del pasto → mangiato. */
  eaten: z.record(safeKey, z.boolean()),
  /**
   * Fonte (giorno del piano e variante) di ogni pasto spuntato (2c): se poi il tipo di giornata cambia, i pasti già
   * segnati restano com'erano. `type: null` = la variante predefinita di quel giorno.
   */
  mealSources: z.record(safeKey, mealsFromSchema).default({}),
});

export type DietLogDay = z.infer<typeof dietLogSchema>;
export type MealsFrom = z.infer<typeof mealsFromSchema>;
