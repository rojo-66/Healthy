import { z } from 'zod';
import { MAX_TEXT } from '../limits';
import { int, num, text } from './common';

/** Il profilo è una riga sola, sempre con questo id. */
export const PROFILE_ID = 'me';

/** Obiettivo: decide in M7 quale direzione di una variazione è "giusta" (SPEC § 5.6). */
export const goalSchema = z.enum(['lose', 'gain', 'maintain', 'recomp']);

export const profileSchema = z.object({
  id: z.literal(PROFILE_ID),
  name: text(MAX_TEXT.name),
  birthYear: int(1900, 2100).nullable(),
  sex: z.enum(['M', 'F']).nullable(),
  heightCm: num(50, 250).nullable(),
  goal: goalSchema.nullable(),
});

export type Profile = z.infer<typeof profileSchema>;
export type Goal = z.infer<typeof goalSchema>;
