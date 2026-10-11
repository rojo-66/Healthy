import { parseDietFile } from '../../../src/lib/data/read-file';
import type { DietFile } from '../../../src/lib/data/schemas/diet-file';
import { dietPayloadSchema, type DietPayload } from '../../../src/lib/data/schemas/diet-payload';
import extendedFixture from '../../fixtures/diet-extended.json';
import myDietFixture from '../../fixtures/mydiet.json';

export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** File MyDiet finto, sempre nuovo (modificabile). */
export function myDietJson(): typeof myDietFixture {
  return clone(myDietFixture);
}

/** Piano esteso finto, sempre nuovo. */
export function extendedJson(): typeof extendedFixture {
  return clone(extendedFixture);
}

export function extendedFile(): DietFile {
  const result = parseDietFile(extendedJson());
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

/** Piano piccolo scritto nel test, con i valori predefiniti dello schema. */
export function payload(input: unknown): DietPayload {
  const result = dietPayloadSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

/** Prodotti di prova con valori semplici (per 100 g). */
export const PRODUCTS = {
  pollo: { name: 'Petto di pollo', cat: 'Carne', unit: 'g', per100: { kcal: 100, protein: 20, carbs: 0, fat: 2, fiber: 0 } },
  riso: { name: 'Riso', cat: 'Cereali', unit: 'g', per100: { kcal: 350, protein: 7, carbs: 80, fat: 1, fiber: 1 } },
  zucchine: { name: 'Zucchine', cat: 'Verdura', unit: 'g', per100: { kcal: 20, protein: 1, carbs: 3, fat: 0, fiber: 1 } },
  uova: { name: 'Uova', cat: 'Uova', unit: 'pz', pieceGrams: 50, per100: { kcal: 140, protein: 12, carbs: 1, fat: 10 } },
  latte: { name: 'Latte', cat: 'Latticini', unit: 'ml', per100: { kcal: 50, protein: 3, carbs: 5, fat: 2, fiber: 0 } },
  ignoto: { name: 'Salsa misteriosa', cat: 'Dispensa', unit: 'g' },
  pizza: { name: 'Pizza', cat: 'Pasto libero', unit: 'pz', shop: false, per100: { kcal: 250, protein: 10, carbs: 33, fat: 8 } },
} as const;
