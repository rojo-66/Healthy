import { formatNumber } from '../components/stepper';
import type { Session } from '../data/schemas/sessions';
import { matchSessionItems, sessionItems } from './items';
import { bestSet, missingSets, setsOf } from './stats';

/**
 * Confronto di un esercizio con l'ultima volta (Riepilogo): `warn` (giallo) se mancano serie,
 * `up` (ciano) se la serie migliore è migliorata, `same`/`down` (grigio), `first` senza storico.
 */
export type DeltaKind = 'up' | 'same' | 'down' | 'warn' | 'first';

export interface Delta {
  kind: DeltaKind;
  text: string;
}

const signed = (n: number, unit: string) => `${n > 0 ? '+' : '−'}${formatNumber(Math.abs(n))} ${unit}`;

export function compareWithLast(
  session: Pick<Session, 'sets' | 'snapshot'>,
  itemIndex: number,
  previous: Pick<Session, 'sets' | 'snapshot'> | null | undefined,
): Delta {
  const missing = missingSets(session, itemIndex);
  if (missing > 0) return { kind: 'warn', text: `−${missing} serie` };

  const current = bestSet(setsOf(session, itemIndex));
  const prevIndex = previous ? matchSessionItems(sessionItems(session), previous)[itemIndex] : null;
  const before = previous && prevIndex !== null && prevIndex !== undefined ? bestSet(setsOf(previous, prevIndex)) : null;
  if (!current || !before) return { kind: 'first', text: 'prima volta' };

  const dkg = Math.round((current.kg - before.kg) * 100) / 100;
  if (dkg !== 0) return { kind: dkg > 0 ? 'up' : 'down', text: signed(dkg, 'kg') };
  const dreps = current.reps - before.reps;
  if (dreps !== 0) return { kind: dreps > 0 ? 'up' : 'down', text: signed(dreps, 'rip') };
  return { kind: 'same', text: '=' };
}
