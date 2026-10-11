import { z } from 'zod';
import { entityId, isoDate, safeKey, weekday } from './common';

/**
 * Diario della dieta: una riga per giorno (scostamento confermato da § 7, che aveva una riga per pasto).
 * Lo scambio "oggi seguo il piano di un altro giorno" è un dato del giorno, non del singolo pasto.
 */
export const dietLogSchema = z.object({
  date: isoDate,
  planId: entityId,
  /** Giorno del piano seguito al posto di quello del calendario; `null` = nessuno scambio. */
  swappedFromWeekday: weekday.nullable(),
  /** Chiave del pasto → mangiato. */
  eaten: z.record(safeKey, z.boolean()),
});

export type DietLogDay = z.infer<typeof dietLogSchema>;
