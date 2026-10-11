import { z } from 'zod';
import { isoDate, safeKey } from './common';

function isMonday(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getDay() === 1;
}

/** Spunte della lista della spesa di una settimana (SPEC § 7, `shopping`). */
export const shoppingSchema = z.object({
  /** Lunedì della settimana. */
  weekStart: isoDate.refine(isMonday, 'deve essere un lunedì'),
  /** Chiave del prodotto → spuntato. */
  checked: z.record(safeKey, z.boolean()),
});

export type ShoppingWeek = z.infer<typeof shoppingSchema>;
