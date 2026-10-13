import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../limits';
import { entityId, int, isoDateTime, num, requiredText } from './common';
import { kgSchema, repsSchema, versionSchema, workoutItemSchema } from './workouts';

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

/**
 * Cronometro di un esercizio cardio (2a), basato su istanti come il recupero: in corso `runningSince`
 * è l'istante di (ri)partenza; `elapsedMs` è il tempo accumulato prima di quell'istante.
 */
export const stopwatchSchema = z.object({
  runningSince: isoDateTime.nullable(),
  elapsedMs: int(0, 24 * 3_600_000),
});

/** Esito di un esercizio cardio della sessione (2a): uno per ogni cardio della copia della scheda. */
export const sessionCardioSchema = z.object({
  itemIndex: int(0, MAX_ITEMS.workoutItems - 1),
  /** Minuti e km effettivi; `null` = non scritti. */
  minutes: num(0, 600).nullable(),
  distanceKm: num(0, 500).nullable(),
  done: z.boolean(),
  clock: stopwatchSchema,
});

/**
 * Copia degli esercizi della scheda al momento dell'avvio (M5): sessione e riepilogo restano corretti
 * anche se la scheda viene poi modificata o eliminata. Nome e versione sono in `workoutName`/`workoutVersion`.
 * Dal 2a contiene anche gli esercizi cardio (il vecchio `cardio` è diventato un elemento in fondo).
 */
export const sessionSnapshotSchema = z.object({
  items: z.array(workoutItemSchema).min(1).max(MAX_ITEMS.workoutItems),
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
    /** Esercizi cardio della sessione (2a, ex `cardioDone`). */
    cardio: z.array(sessionCardioSchema).max(MAX_ITEMS.workoutItems).default([]),
    /** `null` per le sessioni precedenti al M5 (backup vecchi). */
    snapshot: sessionSnapshotSchema.nullable().default(null),
    live: sessionLiveSchema.nullable().default(null),
  })
  .superRefine((session, ctx) => {
    if (session.endedAt !== null && Date.parse(session.endedAt) < Date.parse(session.startedAt)) {
      ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'la fine è prima dell’inizio' });
    }
    const seen = new Set<number>();
    session.cardio.forEach((c, i) => {
      if (seen.has(c.itemIndex)) {
        ctx.addIssue({ code: 'custom', path: ['cardio', i, 'itemIndex'], message: 'cardio ripetuto' });
      }
      seen.add(c.itemIndex);
    });
    const items = session.snapshot?.items;
    if (items === undefined) {
      if (session.cardio.length > 0) {
        ctx.addIssue({ code: 'custom', path: ['cardio'], message: 'cardio senza la copia della scheda' });
      }
      return;
    }
    session.sets.forEach((set, i) => {
      const item = items[set.itemIndex];
      if (!item) {
        ctx.addIssue({ code: 'custom', path: ['sets', i, 'itemIndex'], message: `la scheda ha solo ${items.length} esercizi` });
      } else if (item.kind !== 'strength') {
        ctx.addIssue({ code: 'custom', path: ['sets', i, 'itemIndex'], message: 'serie su un esercizio cardio' });
      }
    });
    session.cardio.forEach((c, i) => {
      if (items[c.itemIndex]?.kind !== 'cardio') {
        ctx.addIssue({ code: 'custom', path: ['cardio', i, 'itemIndex'], message: 'non è un esercizio cardio' });
      }
    });
    if (session.live && session.live.itemIndex >= items.length) {
      ctx.addIssue({ code: 'custom', path: ['live', 'itemIndex'], message: `la scheda ha solo ${items.length} esercizi` });
    }
  });

export type Session = z.infer<typeof sessionSchema>;
export type SessionInput = z.input<typeof sessionSchema>;
export type SessionSet = z.infer<typeof sessionSetSchema>;
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;
export type SessionLive = z.infer<typeof sessionLiveSchema>;
export type SessionCardio = z.infer<typeof sessionCardioSchema>;
export type Stopwatch = z.infer<typeof stopwatchSchema>;
export type RestTimer = z.infer<typeof restTimerSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type UserNote = z.infer<typeof userNoteSchema>;
