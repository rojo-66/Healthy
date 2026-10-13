import { z } from 'zod';
import { MAX_TEXT } from '../limits';
import { entityId, hhmm, int, isoDate, isoDateTime, num, requiredText, text } from './common';
import { weekdaysSchema } from './workouts';

/** Obiettivo e limiti della corsa (2a). */
export const runMinutesSchema = int(1, 600);
export const runKmSchema = num(0.1, 500);
/** Durata di una corsa fatta: da 1 secondo a 24 ore. */
export const runDurationSecSchema = int(1, 24 * 3600);

/**
 * Attività "Corsa" pianificata (2a): nome, giorni della settimana, orario facoltativo, obiettivo, nota.
 * Non si condivide mai (decisione 2a). Il modulo chiede almeno un obiettivo, il database accetta anche nessuno.
 */
export const runSchema = z.object({
  id: entityId,
  name: requiredText(MAX_TEXT.name),
  weekdays: weekdaysSchema,
  time: hhmm.nullable(),
  targetMinutes: runMinutesSchema.nullable(),
  targetKm: runKmSchema.nullable(),
  note: text(MAX_TEXT.note),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/**
 * Corsa fatta (2a). Il passo non si salva: si calcola da durata e distanza.
 * `runId: null` = corsa fuori programma o corsa poi eliminata; `runName` è una copia del nome (come `workoutName`).
 */
export const runLogSchema = z.object({
  id: entityId,
  runId: entityId.nullable(),
  runName: requiredText(MAX_TEXT.name),
  /** Giorno in cui è stata fatta (locale, `AAAA-MM-GG`). */
  date: isoDate,
  loggedAt: isoDateTime,
  durationSec: runDurationSecSchema,
  distanceKm: runKmSchema.nullable(),
  rpe: int(1, 10).nullable(),
  note: text(MAX_TEXT.note),
});

export type Run = z.infer<typeof runSchema>;
export type RunLog = z.infer<typeof runLogSchema>;
