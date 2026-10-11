import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { entityId, int, isoDateTime, num, requiredText } from './common';
import { kgSchema, repsSchema, versionSchema } from './workouts';

const score = int(1, 5);

/** Readiness survey: 5 = meglio per tutte le voci (SPEC § 5.4). */
export const readinessSchema = z.object({
  sleep: score,
  mood: score,
  energy: score,
  stress: score,
  soreness: score,
});

export const sessionSetSchema = z.object({
  exerciseId: entityId.nullable(),
  /** Posizione dell'esercizio nella scheda: lo stesso esercizio può comparire due volte. */
  itemIndex: int(0, MAX_ITEMS.workoutItems - 1),
  setIndex: int(0, MAX_ITEMS.setsPerItem - 1),
  kg: kgSchema,
  reps: repsSchema,
  done: z.boolean(),
});

/** Nota scritta dall'utente per il PT su un esercizio della sessione. */
export const userNoteSchema = z.object({
  itemIndex: int(0, MAX_ITEMS.workoutItems - 1),
  exerciseId: entityId.nullable(),
  text: requiredText(MAX_TEXT.note),
});

export const cardioDoneSchema = z.object({
  type: requiredText(MAX_TEXT.short),
  minutes: num(0, 600),
  distanceKm: num(0, 500).nullable(),
});

export const sessionSchema = z
  .object({
    id: entityId,
    workoutId: entityId,
    workoutVersion: versionSchema,
    /** Copia del nome: lo storico resta leggibile anche se la scheda cambia o viene cancellata. */
    workoutName: requiredText(MAX_TEXT.name),
    startedAt: isoDateTime,
    /** `null` = sessione in corso. */
    endedAt: isoDateTime.nullable(),
    readiness: readinessSchema.nullable(),
    sets: z.array(sessionSetSchema).max(MAX_ITEMS.workoutItems * MAX_ITEMS.setsPerItem),
    userNotes: z.array(userNoteSchema).max(MAX_ITEMS.workoutItems),
    rpe: int(1, 10).nullable(),
    cardioDone: cardioDoneSchema.nullable(),
  })
  .superRefine((session, ctx) => {
    if (session.endedAt !== null && Date.parse(session.endedAt) < Date.parse(session.startedAt)) {
      ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'la fine è prima dell’inizio' });
    }
  });

export type Session = z.infer<typeof sessionSchema>;
export type SessionSet = z.infer<typeof sessionSetSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
