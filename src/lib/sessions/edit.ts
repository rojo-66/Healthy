import { MAX_ITEMS } from '../data/limits';
import type { RestTimer, Session, SessionSet } from '../data/schemas/sessions';
import { sessionItems } from './items';
import { setsOf } from './stats';

/**
 * Modifiche a una sessione, sempre su copie (la sessione di partenza non cambia).
 * Le spunte dicono anche se deve partire il recupero: solo quando una serie diventa fatta.
 */
export interface Toggled {
  session: Session;
  startRest: boolean;
}

const sameSet = (s: SessionSet, itemIndex: number, setIndex: number) => s.itemIndex === itemIndex && s.setIndex === setIndex;

function mapSets(session: Session, fn: (s: SessionSet) => SessionSet): Session {
  return { ...session, sets: session.sets.map(fn) };
}

/** Spunta o toglie la spunta a una serie. */
export function toggleSet(session: Session, itemIndex: number, setIndex: number): Toggled {
  const target = session.sets.find((s) => sameSet(s, itemIndex, setIndex));
  if (!target) return { session, startRest: false };
  const done = !target.done;
  return { session: mapSets(session, (s) => (sameSet(s, itemIndex, setIndex) ? { ...s, done } : s)), startRest: done };
}

/** Tutte le serie dell'esercizio sono fatte? */
export function allDone(session: Pick<Session, 'sets'>, itemIndex: number): boolean {
  const sets = setsOf(session, itemIndex);
  return sets.length > 0 && sets.every((s) => s.done);
}

/** Doppia spunta: se sono tutte fatte le toglie tutte, altrimenti le segna tutte. */
export function toggleAll(session: Session, itemIndex: number): Toggled {
  const done = !allDone(session, itemIndex);
  return {
    session: mapSets(session, (s) => (s.itemIndex === itemIndex ? { ...s, done } : s)),
    startRest: done,
  };
}

export function updateSet(
  session: Session,
  itemIndex: number,
  setIndex: number,
  patch: Partial<Pick<SessionSet, 'kg' | 'reps'>>,
): Session {
  return mapSets(session, (s) => (sameSet(s, itemIndex, setIndex) ? { ...s, ...patch } : s));
}

export function canAddSet(session: Pick<Session, 'sets'>, itemIndex: number): boolean {
  return setsOf(session, itemIndex).length < MAX_ITEMS.setsPerItem;
}

/** "+ Aggiungi serie": copia kg e ripetizioni dell'ultima serie dell'esercizio, da fare. */
export function addSet(session: Session, itemIndex: number): Session {
  if (!canAddSet(session, itemIndex)) return session;
  const sets = setsOf(session, itemIndex);
  const last = sets[sets.length - 1];
  const item = sessionItems(session)[itemIndex];
  const set: SessionSet = {
    exerciseId: item?.exerciseId ?? last?.exerciseId ?? null,
    itemIndex,
    setIndex: last ? last.setIndex + 1 : 0,
    kg: last?.kg ?? item?.kg ?? 0,
    reps: last?.reps ?? item?.reps ?? 0,
    done: false,
  };
  return { ...session, sets: [...session.sets, set] };
}

export function noteFor(session: Pick<Session, 'userNotes'>, itemIndex: number): string {
  return session.userNotes.find((n) => n.itemIndex === itemIndex)?.text ?? '';
}

/** "Le tue note per il PT": testo vuoto = nessuna nota. */
export function setUserNote(session: Session, itemIndex: number, text: string): Session {
  const others = session.userNotes.filter((n) => n.itemIndex !== itemIndex);
  if (text.trim() === '') return { ...session, userNotes: others };
  const exerciseId = sessionItems(session)[itemIndex]?.exerciseId ?? null;
  return {
    ...session,
    userNotes: [...others, { itemIndex, exerciseId, text }].sort((a, b) => a.itemIndex - b.itemIndex),
  };
}

export function currentItem(session: Pick<Session, 'live'>): number {
  return session.live?.itemIndex ?? 0;
}

/** Esercizio mostrato (PREC/SUCC), dentro i limiti. */
export function goToItem(session: Session, itemIndex: number): Session {
  const count = sessionItems(session).length;
  const next = Math.min(count - 1, Math.max(0, itemIndex));
  return { ...session, live: { itemIndex: next, rest: session.live?.rest ?? null } };
}

export function setRest(session: Session, rest: RestTimer | null): Session {
  return { ...session, live: { itemIndex: currentItem(session), rest } };
}

/** Cardio finale fatto sì/no (con i minuti del piano). */
export function setCardioDone(session: Session, done: boolean): Session {
  const cardio = session.snapshot?.cardio ?? null;
  return { ...session, cardioDone: done && cardio ? { type: cardio.type, minutes: cardio.minutes, distanceKm: null } : null };
}

export function setRpe(session: Session, rpe: number | null): Session {
  return { ...session, rpe };
}

/** Conclude: istante di fine (mai prima dell'inizio) e niente più stato "in corso". */
export function finish(session: Session, now: Date): Session {
  const end = Math.max(now.getTime(), Date.parse(session.startedAt));
  return { ...session, endedAt: new Date(end).toISOString(), live: null };
}
