import type { Session, SessionCardio } from '../data/schemas/sessions';
import type { CardioItem } from '../data/schemas/workouts';
import { sessionItems, matchSessionItems, type ItemRef } from './items';
import { elapsedMinutes, pauseClock, startClock, STOPPED } from './stopwatch';

/**
 * Esercizi cardio della sessione (2a): una voce in `session.cardio` per ogni cardio della copia della scheda,
 * con minuti e km effettivi, spunta "fatto" e cronometro. Modifiche sempre su copie.
 */

type WithCardio = Pick<Session, 'cardio'>;

/** Voce vuota di un cardio (alla creazione della sessione). */
export function emptyCardioEntry(itemIndex: number): SessionCardio {
  return { itemIndex, minutes: null, distanceKm: null, done: false, clock: { ...STOPPED } };
}

export function cardioEntry(session: WithCardio, itemIndex: number): SessionCardio | null {
  return session.cardio.find((c) => c.itemIndex === itemIndex) ?? null;
}

/** Esercizio cardio della copia della scheda (o `null` se a quella posizione c'è un esercizio di forza). */
export function cardioItemAt(session: Pick<Session, 'snapshot' | 'sets'>, itemIndex: number): CardioItem | null {
  const item = sessionItems(session)[itemIndex];
  return item?.kind === 'cardio' ? item : null;
}

function patchEntry(session: Session, itemIndex: number, fn: (c: SessionCardio) => SessionCardio): Session {
  const existing = cardioEntry(session, itemIndex);
  if (!existing) {
    if (!cardioItemAt(session, itemIndex)) return session;
    return { ...session, cardio: [...session.cardio, fn(emptyCardioEntry(itemIndex))].sort((a, b) => a.itemIndex - b.itemIndex) };
  }
  return { ...session, cardio: session.cardio.map((c) => (c.itemIndex === itemIndex ? fn(c) : c)) };
}

/** Minuti o km scritti a mano (`null` = campo vuoto). */
export function setCardioValues(
  session: Session,
  itemIndex: number,
  patch: Partial<Pick<SessionCardio, 'minutes' | 'distanceKm'>>,
): Session {
  return patchEntry(session, itemIndex, (c) => ({ ...c, ...patch }));
}

export function startCardioClock(session: Session, itemIndex: number, now: number): Session {
  return patchEntry(session, itemIndex, (c) => ({ ...c, clock: startClock(c.clock, now) }));
}

export function pauseCardioClock(session: Session, itemIndex: number, now: number): Session {
  return patchEntry(session, itemIndex, (c) => ({ ...c, clock: pauseClock(c.clock, now) }));
}

/**
 * Spunta "Fatto" (o la toglie). Segnando fatto il cronometro si ferma e, se i minuti non sono stati scritti,
 * prende quelli del cronometro. La spunta del cardio non avvia il recupero (decisione 2a).
 */
export function toggleCardioDone(session: Session, itemIndex: number, now: number): Session {
  return patchEntry(session, itemIndex, (c) => {
    if (c.done) return { ...c, done: false };
    const clock = pauseClock(c.clock, now);
    const fromClock = elapsedMinutes(clock, now);
    return { ...c, done: true, clock, minutes: c.minutes ?? (fromClock > 0 ? fromClock : null) };
  });
}

/** Cardio fatti e previsti della sessione. */
export function cardioCounts(session: Pick<Session, 'snapshot' | 'sets' | 'cardio'>): { done: number; total: number } {
  const items = sessionItems(session);
  let total = 0;
  let done = 0;
  items.forEach((item, i) => {
    if (item.kind !== 'cardio') return;
    total++;
    if (cardioEntry(session, i)?.done) done++;
  });
  return { done, total };
}

export interface LastCardio {
  minutes: number | null;
  distanceKm: number | null;
  done: boolean;
}

/** "Ultima volta" del cardio: per ogni esercizio di `items` la voce dello stesso cardio nella sessione precedente. */
export function lastCardioTable(
  items: readonly ItemRef[],
  previous: Pick<Session, 'snapshot' | 'sets' | 'cardio'> | null | undefined,
): (LastCardio | null)[] {
  if (!previous) return items.map(() => null);
  const match = matchSessionItems(items, previous);
  return match.map((prevIndex) => {
    if (prevIndex === null) return null;
    const entry = cardioEntry(previous, prevIndex);
    return entry ? { minutes: entry.minutes, distanceKm: entry.distanceKm, done: entry.done } : null;
  });
}
