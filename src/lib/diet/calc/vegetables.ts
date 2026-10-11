import { lookup } from '../../data/errors';
import type { DietDay, DietPayload } from '../../data/schemas/diet-payload';

/**
 * Radici dei nomi di verdure (§ 6.2, "giorni senza verdura"). La categoria non basta: "Frutta e verdura"
 * contiene anche banane e mele, e le verdure surgelate stanno in "Surgelati".
 */
export const VEGETABLE_STEMS: readonly string[] = [
  'verdur',
  'insalat',
  'pomodor',
  'zucchin',
  'spinac',
  'broccol',
  'carot',
  'fagiolin',
  'peperon',
  'melanzan',
  'cavol',
  'lattug',
  'rucol',
  'finocch',
  'cetriol',
  'asparag',
  'carciof',
  'funghi',
  'bietol',
  'cicori',
  'verza',
  'minestron',
  'piselli',
];

/** Minuscolo e senza accenti, per confrontare i nomi. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function isVegetable(productName: string): boolean {
  const name = normalizeName(productName);
  return VEGETABLE_STEMS.some((stem) => name.includes(stem));
}

/** `true` se almeno un alimento del giorno è una verdura. */
export function dayHasVegetables(day: DietDay, products: DietPayload['products']): boolean {
  return day.meals.some((meal) =>
    meal.items.some((item) => {
      const product = lookup(products, item.p);
      return product !== undefined && isVegetable(product.name);
    }),
  );
}
