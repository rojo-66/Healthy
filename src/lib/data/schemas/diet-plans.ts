import { z } from 'zod';
import { MAX_TEXT } from '../limits';
import { entityId, isoDate, isoDateTime, requiredText, text } from './common';
import { dietPayloadSchema } from './diet-payload';
import { versionSchema } from './workouts';

/** Da che file arriva il piano: formato esteso di Healthy (§ 8.2) o MyDiet (§ 8.3). */
export const dietPlanOriginSchema = z.enum(['file', 'mydiet']);

/** Piano alimentare salvato (SPEC § 7, `dietPlans`). Un solo piano ha `active: true`. */
export const dietPlanSchema = z.object({
  id: entityId,
  version: versionSchema,
  title: requiredText(MAX_TEXT.name),
  author: text(MAX_TEXT.name),
  validFrom: isoDate.nullable(),
  active: z.boolean(),
  archived: z.boolean(),
  /** Quando è stato importato. Aggiunto in M3: i piani salvati prima non ce l'hanno. */
  importedAt: isoDateTime.nullable().default(null),
  origin: dietPlanOriginSchema.default('file'),
  payload: dietPayloadSchema,
});

export type DietPlan = z.infer<typeof dietPlanSchema>;
export type DietPlanOrigin = z.infer<typeof dietPlanOriginSchema>;
