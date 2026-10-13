import type { Session } from '../data/schemas/sessions';
import type { StrengthItem } from '../data/schemas/workouts';
import { matchSessionItems, type ItemRef } from './items';

export interface LastSet {
  kg: number;
  reps: number;
  done: boolean;
}

/**
 * "Ultima volta" (SPEC § 6.4): per ogni esercizio di `items`, le serie dello stesso esercizio
 * nell'ultima sessione conclusa con la stessa scheda, per numero di serie (`[i][setIndex]`).
 */
export function lastTimeTable(
  items: readonly ItemRef[],
  previous: Pick<Session, 'snapshot' | 'sets'> | null | undefined,
): (LastSet | undefined)[][] {
  if (!previous) return items.map(() => []);
  const match = matchSessionItems(items, previous);
  return match.map((prevIndex) => {
    const row: (LastSet | undefined)[] = [];
    if (prevIndex === null) return row;
    for (const set of previous.sets) {
      if (set.itemIndex === prevIndex) row[set.setIndex] = { kg: set.kg, reps: set.reps, done: set.done };
    }
    return row;
  });
}

/**
 * Valori di partenza di una serie: quelli dell'ultima volta se quella serie era stata fatta,
 * altrimenti quelli del piano (con "Serie diverse tra loro" quelli della serie).
 */
export function prefill(item: Pick<StrengthItem, 'kg' | 'reps' | 'setsDetail'>, setIndex: number, last?: LastSet): { kg: number; reps: number } {
  if (last?.done) return { kg: last.kg, reps: last.reps };
  const detail = item.setsDetail?.[setIndex];
  return detail ? { kg: detail.kg, reps: detail.reps } : { kg: item.kg, reps: item.reps };
}
