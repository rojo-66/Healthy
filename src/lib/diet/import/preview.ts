import type { DietPlan } from '../../data/schemas/diet-plans';
import { planCompleteness, type Completeness } from '../calc/completeness';
import { isEmptyMeal } from '../calc/meal-now';
import type { DietImport } from './detect';

/** Piano già salvato con lo stesso id: `newer` = il file ha una versione maggiore. */
export type ImportConflict =
  | { kind: 'none' }
  | { kind: 'newer' | 'same-or-older'; existing: DietPlan };

export interface DietImportPreview {
  title: string;
  author: string;
  validFrom: string | null;
  version: number;
  origin: DietImport['origin'];
  days: number;
  /** Pasti con nome o alimenti (i pasti vuoti non contano). */
  meals: number;
  products: number;
  recipes: number;
  /** Avvisi della conversione + cosa manca, in italiano. */
  warnings: string[];
  completeness: Completeness;
  conflict: ImportConflict;
}

export function findConflict(incoming: DietImport, plans: readonly DietPlan[]): ImportConflict {
  const existing = plans.find((plan) => plan.id === incoming.file.id);
  if (!existing) return { kind: 'none' };
  return { kind: incoming.file.version > existing.version ? 'newer' : 'same-or-older', existing };
}

function missingWarnings(completeness: Completeness): string[] {
  return completeness.items.filter((item) => !item.done && item.detail !== '').map((item) => item.detail);
}

export function previewDietImport(incoming: DietImport, plans: readonly DietPlan[]): DietImportPreview {
  const { file } = incoming;
  const completeness = planCompleteness(file);
  return {
    title: file.title,
    author: file.author,
    validFrom: file.validFrom,
    version: file.version,
    origin: incoming.origin,
    days: file.days.length,
    meals: file.days.reduce((n, day) => n + day.meals.filter((meal) => !isEmptyMeal(meal)).length, 0),
    products: Object.keys(file.products).length,
    recipes: file.recipes.length,
    warnings: [...incoming.warnings, ...missingWarnings(completeness)],
    completeness,
    conflict: findConflict(incoming, plans),
  };
}
