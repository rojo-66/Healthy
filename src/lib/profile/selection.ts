import type { Measurement } from '../data/schemas/measurements';

/**
 * Le due misure a confronto. Predefinito: l'ultima e quella prima. La scelta dell'utente vale finché
 * entrambe le misure esistono; se una sparisce (eliminata) si torna al predefinito.
 */

export interface Pair {
  beforeId: string | null;
  afterId: string | null;
}

type Dated = Pick<Measurement, 'id' | 'date'>;

const byDate = <T extends Dated>(list: readonly T[]) => [...list].sort((a, b) => a.date.localeCompare(b.date));

export function defaultPair(list: readonly Dated[]): Pair {
  const sorted = byDate(list);
  return { afterId: sorted.at(-1)?.id ?? null, beforeId: sorted.at(-2)?.id ?? null };
}

/** Misure da mostrare: la scelta se è ancora valida, altrimenti il predefinito. */
export function resolvePair<T extends Dated>(list: readonly T[], chosen: Pair | null): { before: T | undefined; after: T | undefined } {
  const find = (id: string | null) => (id === null ? undefined : list.find((m) => m.id === id));
  if (chosen) {
    const before = find(chosen.beforeId);
    const after = find(chosen.afterId);
    if (before && after && before.id !== after.id) return before.date <= after.date ? { before, after } : { before: after, after: before };
  }
  const pair = defaultPair(list);
  return { before: find(pair.beforeId), after: find(pair.afterId) };
}

/**
 * Nuova scelta di una delle due date: la data scelta resta dal lato scelto. Se l'altra non va più bene
 * (stessa data o ordine invertito) si sposta sulla misura vicina: la precedente resta sempre la più vecchia.
 * La misura più vecchia può essere solo "precedente", la più recente solo "attuale".
 */
export function pickDate(list: readonly Dated[], current: { beforeId: string; afterId: string }, side: 'before' | 'after', id: string): Pair {
  const sorted = byDate(list);
  const i = sorted.findIndex((m) => m.id === id);
  const chosen = sorted[i];
  if (!chosen) return current;
  const date = (x: string) => sorted.find((m) => m.id === x)?.date ?? '';

  if (side === 'after') {
    if (date(current.beforeId) < chosen.date) return { beforeId: current.beforeId, afterId: id };
    const prev = sorted[i - 1];
    if (prev) return { beforeId: prev.id, afterId: id };
    return { beforeId: id, afterId: sorted[i + 1]?.id ?? current.afterId };
  }
  if (chosen.date < date(current.afterId)) return { beforeId: id, afterId: current.afterId };
  const next = sorted[i + 1];
  if (next) return { beforeId: id, afterId: next.id };
  return { beforeId: sorted[i - 1]?.id ?? current.beforeId, afterId: id };
}
