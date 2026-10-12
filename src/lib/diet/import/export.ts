import { parseOrThrow } from '../../data/errors';
import { APP_ID } from '../../data/schemas/common';
import { DIET_FILE_KIND, DIET_FILE_VERSION, dietFileSchema, type DietFile } from '../../data/schemas/diet-file';
import type { DietPlan } from '../../data/schemas/diet-plans';
import { safeSlug } from '../../share/file-name';

/** Piano salvato → file esteso (§ 8.2), validato: si esporta solo ciò che si saprebbe reimportare. */
export function planToDietFile(plan: DietPlan): DietFile {
  return parseOrThrow(dietFileSchema, {
    app: APP_ID,
    kind: DIET_FILE_KIND,
    schemaVersion: DIET_FILE_VERSION,
    id: plan.id,
    version: plan.version,
    title: plan.title,
    author: plan.author,
    validFrom: plan.validFrom,
    // Lista bianca (§ 8.2): solo il contenuto del piano. I campi annidati in più li scarta lo schema.
    dayTypes: plan.payload.dayTypes,
    categories: plan.payload.categories,
    products: plan.payload.products,
    days: plan.payload.days,
    recipes: plan.payload.recipes,
  });
}

/** "healthy-dieta-ottobre-2026.json". */
export function dietFileName(title: string): string {
  return `healthy-dieta-${safeSlug(title, 'piano')}.json`;
}

/** File da consegnare con `deliverFile` (Web Share con file, altrimenti download). */
export function planExportFile(plan: DietPlan): File {
  const json = JSON.stringify(planToDietFile(plan), null, 2);
  return new File([json], dietFileName(plan.title), { type: 'application/json' });
}
