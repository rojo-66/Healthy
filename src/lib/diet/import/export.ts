import { parseOrThrow } from '../../data/errors';
import { APP_ID } from '../../data/schemas/common';
import { DIET_FILE_KIND, DIET_FILE_VERSION, dietFileSchema, type DietFile } from '../../data/schemas/diet-file';
import type { DietPlan } from '../../data/schemas/diet-plans';
import { normalizeName } from '../calc/vegetables';

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
    ...plan.payload,
  });
}

/** "healthy-dieta-ottobre-2026.json". */
export function dietFileName(title: string): string {
  const slug = normalizeName(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `healthy-dieta-${slug || 'piano'}.json`;
}

/** File da consegnare con `deliverFile` (Web Share con file, altrimenti download). */
export function planExportFile(plan: DietPlan): File {
  const json = JSON.stringify(planToDietFile(plan), null, 2);
  return new File([json], dietFileName(plan.title), { type: 'application/json' });
}
