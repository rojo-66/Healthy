import { lookup } from '../../data/errors';
import type { DietPlan } from '../../data/schemas/diet-plans';
import { planCompleteness, type Completeness } from '../calc/completeness';
import { isEmptyMeal } from '../calc/meal-now';
import type { DietImport } from './detect';
import { defaultVariant } from '../variants';

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
  /** Pasti con nome o alimenti (i pasti vuoti non contano), nella variante predefinita di ogni giorno. */
  meals: number;
  /** Giorni con più varianti (2b) e le etichette dei loro tipi ("palestra", "riposo"). */
  variants: { weekday: number; types: string[] }[];
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
    // Pasti della settimana del piano (variante predefinita di ogni giorno).
    meals: file.days.reduce((n, day) => n + defaultVariant(day).meals.filter((meal) => !isEmptyMeal(meal)).length, 0),
    /** Giorni con più varianti (2b): "Lun · palestra + riposo". */
    variants: file.days
      .filter((day) => day.variants.length > 1)
      .map((day) => ({
        weekday: day.weekday,
        types: day.variants.map((v) => (v.type === null ? 'senza tipo' : (lookup(file.dayTypes, v.type)?.label ?? v.type).toLowerCase())),
      })),
    products: Object.keys(file.products).length,
    recipes: file.recipes.length,
    warnings: [...incoming.warnings, ...missingWarnings(completeness)],
    completeness,
    conflict: findConflict(incoming, plans),
  };
}
