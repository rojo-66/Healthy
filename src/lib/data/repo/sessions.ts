import { Dexie } from 'dexie';
import { db } from '../db';
import type { Session } from '../schemas/sessions';
import { createTableRepo } from './table-repo';

export const sessionsRepo = createTableRepo('sessions');

const byWorkout = (workoutId: string) =>
  db.sessions.where('[workoutId+startedAt]').between([workoutId, Dexie.minKey], [workoutId, Dexie.maxKey]);

/** Sessioni di una scheda, dalla più vecchia alla più recente. */
export function sessionsForWorkout(workoutId: string): Promise<Session[]> {
  return byWorkout(workoutId).toArray();
}

/** Ultima sessione di una scheda: serve per "ultima volta" (SPEC § 6.4). */
export function lastSessionForWorkout(workoutId: string): Promise<Session | undefined> {
  return byWorkout(workoutId).last();
}

/** Sessioni iniziate nell'intervallo [from, to) (istanti ISO): storico e calendario. */
export function sessionsBetween(from: string, to: string): Promise<Session[]> {
  return db.sessions.where('startedAt').between(from, to, true, false).toArray();
}
