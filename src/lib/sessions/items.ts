import type { Session } from '../data/schemas/sessions';
import type { WorkoutItem } from '../data/schemas/workouts';

/** Quel che serve per riconoscere un esercizio tra due sessioni. */
export interface ItemRef {
  exerciseId: string | null;
  name: string;
}

/** Nome confrontabile: minuscole, senza accenti né spazi doppi. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identità di un esercizio: l'id della libreria, altrimenti il nome. `null` se non c'è nessuno dei due. */
export function exerciseKey(item: ItemRef): string | null {
  if (item.exerciseId) return `id:${item.exerciseId}`;
  const name = normalizeName(item.name);
  return name ? `name:${name}` : null;
}

/**
 * Esercizi di una sessione. Dalla copia della scheda (M5); per le sessioni più vecchie, senza copia,
 * ricostruiti dalle serie (nome sconosciuto, piano = serie salvate).
 */
export function sessionItems(session: Pick<Session, 'snapshot' | 'sets'>): WorkoutItem[] {
  if (session.snapshot) return session.snapshot.items;
  const byIndex = new Map<number, { exerciseId: string | null; count: number; first: { kg: number; reps: number } }>();
  for (const set of session.sets) {
    const entry = byIndex.get(set.itemIndex);
    if (entry) entry.count = Math.max(entry.count, set.setIndex + 1);
    else byIndex.set(set.itemIndex, { exerciseId: set.exerciseId, count: set.setIndex + 1, first: { kg: set.kg, reps: set.reps } });
  }
  const max = Math.max(-1, ...byIndex.keys());
  const items: WorkoutItem[] = [];
  for (let i = 0; i <= max; i++) {
    const entry = byIndex.get(i);
    items.push({
      kind: 'strength',
      exerciseId: entry?.exerciseId ?? null,
      name: `Esercizio ${i + 1}`,
      muscles: [],
      sets: Math.max(1, entry?.count ?? 1),
      reps: entry?.first.reps ?? 0,
      kg: entry?.first.kg ?? 0,
      restSec: 90,
      note: '',
      videoUrl: null,
      setsDetail: null,
    });
  }
  return items;
}

/** Sessione senza copia della scheda: i nomi degli esercizi non sono noti e non si confrontano per nome. */
function refsOf(session: Pick<Session, 'snapshot' | 'sets'>): ItemRef[] {
  return sessionItems(session).map((item) => (session.snapshot ? item : { exerciseId: item.exerciseId, name: '' }));
}

/**
 * Per ogni esercizio di `current`, la posizione dello stesso esercizio in `previous` (o `null`).
 * Si abbinano per id (o nome) e occorrenza: il secondo "Panca piana" va con il secondo,
 * anche se nel frattempo la scheda è stata riordinata.
 */
export function matchItems(current: readonly ItemRef[], previous: readonly ItemRef[]): (number | null)[] {
  const positions = new Map<string, number[]>();
  previous.forEach((item, i) => {
    const key = exerciseKey(item);
    if (key === null) return;
    positions.set(key, [...(positions.get(key) ?? []), i]);
  });
  const used = new Map<string, number>();
  return current.map((item) => {
    const key = exerciseKey(item);
    if (key === null) return null;
    const k = used.get(key) ?? 0;
    used.set(key, k + 1);
    return positions.get(key)?.[k] ?? null;
  });
}

export function matchSessionItems(
  current: readonly ItemRef[],
  previous: Pick<Session, 'snapshot' | 'sets'>,
): (number | null)[] {
  return matchItems(current, refsOf(previous));
}
