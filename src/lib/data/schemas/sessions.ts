import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { entityId, int, isoDateTime, num, requiredText } from './common';
import { cardioSchema, kgSchema, repsSchema, versionSchema, workoutItemSchema } from './workouts';

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
  /** Le serie oltre quelle del piano (`setIndex ≥ sets`) sono serie aggiunte durante la sessione. */
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

/**
 * Copia degli esercizi della scheda al momento dell'avvio (M5): sessione e riepilogo restano corretti
 * anche se la scheda viene poi modificata o eliminata. Nome e versione sono in `workoutName`/`workoutVersion`.
 */
export const sessionSnapshotSchema = z.object({
  items: z.array(workoutItemSchema).min(1).max(MAX_ITEMS.workoutItems),
  cardio: cardioSchema.nullable(),
});

/**
 * Recupero basato su istanti, mai su un contatore: se iOS sospende la pagina il tempo resta giusto.
 * In corso: `endsAt` = istante di fine. In pausa: `endsAt: null` e `pausedRemainingMs` = tempo rimasto.
 */
export const restTimerSchema = z.object({
  /** Durata di partenza (per il riempimento del cerchio). */
  totalSec: int(0, 3600),
  endsAt: isoDateTime.nullable(),
  pausedRemainingMs: int(0, 3_600_000).nullable(),
});

/** Stato della sessione in corso: esercizio mostrato e recupero. `null` a sessione conclusa. */
export const sessionLiveSchema = z.object({
  itemIndex: int(0, MAX_ITEMS.workoutItems - 1),
  rest: restTimerSchema.nullable(),
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
    /** `null` per le sessioni precedenti al M5 (backup vecchi). */
    snapshot: sessionSnapshotSchema.nullable().default(null),
    live: sessionLiveSchema.nullable().default(null),
  })
  .superRefine((session, ctx) => {
    if (session.endedAt !== null && Date.parse(session.endedAt) < Date.parse(session.startedAt)) {
      ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'la fine è prima dell’inizio' });
    }
    const items = session.snapshot?.items.length;
    if (items === undefined) return;
    session.sets.forEach((set, i) => {
      if (set.itemIndex >= items) {
        ctx.addIssue({ code: 'custom', path: ['sets', i, 'itemIndex'], message: `la scheda ha solo ${items} esercizi` });
      }
    });
    if (session.live && session.live.itemIndex >= items) {
      ctx.addIssue({ code: 'custom', path: ['live', 'itemIndex'], message: `la scheda ha solo ${items} esercizi` });
    }
  });

export type Session = z.infer<typeof sessionSchema>;
export type SessionInput = z.input<typeof sessionSchema>;
export type SessionSet = z.infer<typeof sessionSetSchema>;
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;
export type SessionLive = z.infer<typeof sessionLiveSchema>;
export type RestTimer = z.infer<typeof restTimerSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type UserNote = z.infer<typeof userNoteSchema>;
export type CardioDone = z.infer<typeof cardioDoneSchema>;
