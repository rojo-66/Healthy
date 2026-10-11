import { z } from 'zod';
import { MAX_TEXT } from '../limits';
import { entityId, isoDate, requiredText, text } from './common';
import { dietPayloadSchema } from './diet-payload';
import { versionSchema } from './workouts';

/** Piano alimentare salvato (SPEC § 7, `dietPlans`). Un solo piano ha `active: true`. */
export const dietPlanSchema = z.object({
  id: entityId,
  version: versionSchema,
  title: requiredText(MAX_TEXT.name),
  author: text(MAX_TEXT.name),
  validFrom: isoDate.nullable(),
  active: z.boolean(),
  archived: z.boolean(),
  payload: dietPayloadSchema,
});

export type DietPlan = z.infer<typeof dietPlanSchema>;
