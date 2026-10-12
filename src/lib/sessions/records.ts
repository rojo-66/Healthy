import type { Session } from '../data/schemas/sessions';
import { exerciseKey, sessionItems } from './items';

/**
 * Record personali (SPEC § 6.4, regola confermata): una serie fatta con kg > 0 è PR se i suoi kg superano
 * il massimo storico tra le serie fatte con ripetizioni ≥ alle sue, per lo stesso esercizio
 * (id della libreria, oppure nome). Senza una serie storica confrontabile non c'è PR.
 * Lo storico sono solo le sessioni concluse iniziate prima. I PR si calcolano, non si salvano.
 */

interface PastSet {
  kg: number;
  reps: number;
}

type History = Map<string, PastSet[]>;

type Recordable = Pick<Session, 'id' | 'startedAt' | 'endedAt' | 'sets' | 'snapshot'>;

/** Chiave dell'esercizio di ogni voce della sessione (le sessioni senza copia della scheda usano solo l'id). */
export function sessionItemKeys(session: Pick<Session, 'snapshot' | 'sets'>): (string | null)[] {
  return sessionItems(session).map((item) => (session.snapshot ? exerciseKey(item) : exerciseKey({ exerciseId: item.exerciseId, name: '' })));
}

/** Chiave dell'esercizio di ogni serie fatta con carico, nella sessione. */
function loadedSets(session: Recordable): { key: string; itemIndex: number; setIndex: number; kg: number; reps: number }[] {
  const keys = sessionItemKeys(session);
  return session.sets
    .filter((s) => s.done && s.kg > 0)
    .flatMap((s) => {
      const key = keys[s.itemIndex];
      return key ? [{ key, itemIndex: s.itemIndex, setIndex: s.setIndex, kg: s.kg, reps: s.reps }] : [];
    });
}

function addToHistory(history: History, session: Recordable): void {
  for (const s of loadedSets(session)) {
    const list = history.get(s.key) ?? [];
    list.push({ kg: s.kg, reps: s.reps });
    history.set(s.key, list);
  }
}

/** Serie da record di una sessione, con il valore precedente confrontabile. */
export interface RecordSet {
  /** Chiave dell'esercizio (`exerciseKey`). */
  key: string;
  itemIndex: number;
  setIndex: number;
  kg: number;
  reps: number;
  /** Massimo storico dei kg tra le serie con ripetizioni ≥ (quello superato). */
  previousKg: number;
}

function prSetsAgainst(history: History, session: Recordable): RecordSet[] {
  const out: RecordSet[] = [];
  for (const s of loadedSets(session)) {
    const comparable = (history.get(s.key) ?? []).filter((p) => p.reps >= s.reps);
    if (comparable.length === 0) continue;
    const max = Math.max(...comparable.map((p) => p.kg));
    if (s.kg > max) out.push({ ...s, previousKg: max });
  }
  return out;
}

/** Serie PR di una sessione rispetto a uno storico: `itemIndex` → numeri di serie da record. */
function prsAgainst(history: History, session: Recordable): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const s of prSetsAgainst(history, session)) out.set(s.itemIndex, [...(out.get(s.itemIndex) ?? []), s.setIndex]);
  return out;
}

const chronological = (a: Recordable, b: Recordable) => a.startedAt.localeCompare(b.startedAt);

/** Esercizi (e serie) con un PR nella sessione, confrontata con le sessioni concluse prima. */
export function sessionRecords(session: Recordable, all: readonly Recordable[]): Map<number, number[]> {
  const history: History = new Map();
  for (const past of [...all].sort(chronological)) {
    if (past.id === session.id || past.endedAt === null || past.startedAt >= session.startedAt) continue;
    addToHistory(history, past);
  }
  return prsAgainst(history, session);
}

/** Numero di esercizi con un PR per ogni sessione conclusa (Storico: adesivo "N PR", conteggio del mese). */
export function recordCountsBySession(all: readonly Recordable[]): Map<string, number> {
  const history: History = new Map();
  const out = new Map<string, number>();
  for (const session of [...all].filter((s) => s.endedAt !== null).sort(chronological)) {
    out.set(session.id, prsAgainst(history, session).size);
    addToHistory(history, session);
  }
  return out;
}

/**
 * Record di tutto lo storico in un solo passaggio (Progressi, M9): per ogni sessione conclusa le serie PR
 * con il valore precedente. Stessa regola e stesso storico di `sessionRecords`.
 */
export function recordTimeline(all: readonly Recordable[]): Map<string, RecordSet[]> {
  const history: History = new Map();
  const out = new Map<string, RecordSet[]>();
  for (const session of [...all].filter((s) => s.endedAt !== null).sort(chronological)) {
    out.set(session.id, prSetsAgainst(history, session));
    addToHistory(history, session);
  }
  return out;
}
