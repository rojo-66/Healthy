import type { Segment } from '../components/segments';
import type { Session, SessionSet } from '../data/schemas/sessions';
import { sessionItems } from './items';

type SetsOnly = Pick<Session, 'sets'>;
type WithPlan = Pick<Session, 'sets' | 'snapshot'>;

/** Serie di un esercizio, in ordine. */
export function setsOf(session: SetsOnly, itemIndex: number): SessionSet[] {
  return session.sets.filter((s) => s.itemIndex === itemIndex).sort((a, b) => a.setIndex - b.setIndex);
}

/** Serie previste dal piano per un esercizio (le serie aggiunte non contano). */
export function plannedFor(session: WithPlan, itemIndex: number): number {
  return sessionItems(session)[itemIndex]?.sets ?? 0;
}

/** Serie aggiunta durante la sessione, oltre il piano. */
export function isExtra(session: WithPlan, set: Pick<SessionSet, 'itemIndex' | 'setIndex'>): boolean {
  return set.setIndex >= plannedFor(session, set.itemIndex);
}

export function doneFor(session: SetsOnly, itemIndex: number): number {
  return session.sets.filter((s) => s.itemIndex === itemIndex && s.done).length;
}

/** Totale delle serie previste (piano). */
export function plannedSets(session: WithPlan): number {
  return sessionItems(session).reduce((sum, item) => sum + item.sets, 0);
}

/** Serie fatte, comprese quelle aggiunte e spuntate (può superare le previste). */
export function doneSets(session: SetsOnly): number {
  return session.sets.filter((s) => s.done).length;
}

/** Serie del piano non spuntate ("saltate"): le aggiunte non spuntate non contano. */
export function missingSets(session: WithPlan, itemIndex?: number): number {
  return session.sets.filter(
    (s) => !s.done && !isExtra(session, s) && (itemIndex === undefined || s.itemIndex === itemIndex),
  ).length;
}

/** Volume = Σ kg × ripetizioni delle serie fatte (SPEC § 6.4). */
export function volume(sets: readonly Pick<SessionSet, 'kg' | 'reps' | 'done'>[]): number {
  return Math.round(sets.reduce((sum, s) => (s.done ? sum + s.kg * s.reps : sum), 0) * 100) / 100;
}

/** Durata in secondi: fino alla fine, o fino a `now` per una sessione in corso. */
export function durationSec(session: Pick<Session, 'startedAt' | 'endedAt'>, now: number = Date.now()): number {
  const end = session.endedAt === null ? now : Date.parse(session.endedAt);
  return Math.max(0, Math.floor((end - Date.parse(session.startedAt)) / 1000));
}

/** Serie migliore tra quelle fatte: più kg, a parità più ripetizioni. `null` se nessuna è fatta. */
export function bestSet<T extends Pick<SessionSet, 'kg' | 'reps' | 'done'>>(sets: readonly T[]): T | null {
  let best: T | null = null;
  for (const s of sets) {
    if (!s.done) continue;
    if (!best || s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps)) best = s;
  }
  return best;
}

/**
 * Barra a segmenti: uno per esercizio, riempito con serie fatte / serie del piano
 * (le aggiunte non lo fanno andare oltre il pieno).
 */
export function segmentsFor(session: WithPlan): Segment[] {
  return sessionItems(session).map((item, i) => ({ done: Math.min(doneFor(session, i), item.sets), total: item.sets }));
}
