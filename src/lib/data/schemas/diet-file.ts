import { z } from 'zod';
import { MAX_TEXT } from '../limits';
import { entityId, envelope, isoDate, requiredText, text } from './common';
import { checkDietReferences, dietPayloadShape } from './diet-payload';
import { versionSchema } from './workouts';

export const DIET_FILE_KIND = 'diet';
/** 1 è il formato di MyDiet (§ 8.3, conversione in M3); 2 è il formato esteso. */
export const DIET_FILE_VERSION = 2;

/** File di un piano alimentare esteso (SPEC § 8.2). */
export const dietFileSchema = z
  .object({
    ...envelope(DIET_FILE_KIND, DIET_FILE_VERSION),
    id: entityId,
    version: versionSchema,
    title: requiredText(MAX_TEXT.name),
    author: text(MAX_TEXT.name).default(''),
    validFrom: isoDate.nullable().default(null),
    ...dietPayloadShape,
  })
  .superRefine(checkDietReferences);

export type DietFile = z.infer<typeof dietFileSchema>;
