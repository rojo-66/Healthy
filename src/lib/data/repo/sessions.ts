import { Dexie } from 'dexie';
import { db } from '../db';
import { parseOrThrow, ValidationError } from '../errors';
import { sessionSchema, type Session } from '../schemas/sessions';
import { createTableRepo } from './table-repo';

export const sessionsRepo = createTableRepo('sessions');

const byWorkout = (workoutId: string) =>
  db.sessions.where('[workoutId+startedAt]').between([workoutId, Dexie.minKey], [workoutId, Dexie.maxKey]);

/** Sessioni di una scheda, dalla più vecchia alla più recente. */
export function sessionsForWorkout(workoutId: string): Promise<Session[]> {
  return byWorkout(workoutId).toArray();
}

/** Ultima sessione di una scheda (anche in corso). */
export function lastSessionForWorkout(workoutId: string): Promise<Session | undefined> {
  return byWorkout(workoutId).last();
}

/**
 * Ultima sessione **conclusa** di una scheda, iniziata prima di `before` (istante ISO, facoltativo):
 * serve per "ultima volta" e per il confronto nel riepilogo (SPEC § 6.4).
 */
export function lastCompletedForWorkout(workoutId: string, before?: string): Promise<Session | undefined> {
  return byWorkout(workoutId)
    .reverse()
    .filter((s) => s.endedAt !== null && (before === undefined || s.startedAt < before))
    .first();
}

/** Sessioni iniziate nell'intervallo [from, to) (istanti ISO): storico e calendario. */
export function sessionsBetween(from: string, to: string): Promise<Session[]> {
  return db.sessions.where('startedAt').between(from, to, true, false).toArray();
}

/** Sessioni più recenti per prime (settimana, ultima esecuzione delle schede). */
export function recentSessions(limit = 500): Promise<Session[]> {
  return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
}

/** Tutte le sessioni concluse, dalla più vecchia (storico, record). */
export function completedSessions(): Promise<Session[]> {
  return db.sessions
    .orderBy('startedAt')
    .filter((s) => s.endedAt !== null)
    .toArray();
}

/**
 * Sessione in corso (`endedAt: null`), se c'è. I `null` non sono indicizzabili in IndexedDB:
 * si cerca dalla più recente, che di solito è proprio quella in corso.
 */
export async function activeSession(): Promise<Session | null> {
  return (
    (await db.sessions
      .orderBy('startedAt')
      .reverse()
      .filter((s) => s.endedAt === null)
      .first()) ?? null
  );
}

/** C'è già un'altra sessione in corso: si riprende o si abbandona prima di iniziarne una nuova. */
export class ActiveSessionError extends ValidationError {
  readonly active: Session;

  constructor(active: Session) {
    super([`C'è già un allenamento in corso: «${active.workoutName}».`]);
    this.name = 'ActiveSessionError';
    this.active = active;
  }
}

/** Salva la sessione appena iniziata. Una sola sessione in corso per volta. */
export async function startSession(session: Session): Promise<Session> {
  const valid = parseOrThrow(sessionSchema, session);
  return db.transaction('rw', db.sessions, async () => {
    const active = await activeSession();
    if (active && active.id !== valid.id) throw new ActiveSessionError(active);
    await db.sessions.put(valid);
    return valid;
  });
}

/** Salva lo stato della sessione (validato). */
export function saveSession(session: Session): Promise<Session> {
  return sessionsRepo.put(session);
}

/** Elimina una sessione (storico) o abbandona quella in corso. */
export function deleteSession(id: string): Promise<void> {
  return sessionsRepo.remove(id);
}
