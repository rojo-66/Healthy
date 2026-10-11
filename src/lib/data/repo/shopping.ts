import { db } from '../db';
import type { ShoppingWeek } from '../schemas/shopping';
import { createTableRepo } from './table-repo';

export const shoppingRepo = createTableRepo('shopping');

/** Spunta (o toglie la spunta a) un prodotto della lista di una settimana, creando la settimana se serve. */
export function setShoppingChecked(weekStart: string, productKey: string, checked: boolean): Promise<ShoppingWeek> {
  return db.transaction('rw', db.shopping, async () => {
    const week = (await db.shopping.get(weekStart)) ?? { weekStart, checked: {} };
    return shoppingRepo.put({ ...week, checked: { ...week.checked, [productKey]: checked } });
  });
}

/** "Spesa finita": toglie tutte le spunte della settimana. */
export async function resetShopping(weekStart: string): Promise<void> {
  await shoppingRepo.put({ weekStart, checked: {} });
}

/** Le spunte di una settimana, se ci sono. */
export function getShoppingWeek(weekStart: string): Promise<ShoppingWeek | undefined> {
  return db.shopping.get(weekStart);
}
