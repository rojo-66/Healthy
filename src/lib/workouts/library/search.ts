/** Testo per confronti: minuscolo, senza accenti, spazi compattati ("Pànca  PIANA" → "panca piana"). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Searchable {
  name: string;
  /** Il primo è il muscolo principale. */
  muscles: readonly string[];
  /** Forza o cardio (2a); senza = forza. */
  kind?: 'strength' | 'cardio';
}

/**
 * Ricerca nella libreria: ogni parola cercata deve comparire nel nome (maiuscole e accenti non contano);
 * il filtro guarda il muscolo principale, `kind` il tipo (chip "Cardio"). Prima i nomi che iniziano con la ricerca,
 * poi quelli con `priority` (esercizi comuni e personalizzati), poi in ordine alfabetico.
 */
export function searchExercises<T extends Searchable>(
  list: readonly T[],
  query: string,
  muscle: string | null = null,
  priority: (item: T) => boolean = () => false,
  kind: 'strength' | 'cardio' | null = null,
): T[] {
  const q = normalize(query);
  const words = q ? q.split(' ') : [];
  const scored: { item: T; name: string; starts: boolean; first: boolean }[] = [];
  for (const item of list) {
    if (muscle !== null && item.muscles[0] !== muscle) continue;
    if (kind !== null && (item.kind ?? 'strength') !== kind) continue;
    const name = normalize(item.name);
    if (!words.every((w) => name.includes(w))) continue;
    scored.push({ item, name, starts: q !== '' && name.startsWith(q), first: priority(item) });
  }
  scored.sort(
    (a, b) => Number(b.starts) - Number(a.starts) || Number(b.first) - Number(a.first) || a.name.localeCompare(b.name, 'it'),
  );
  return scored.map((s) => s.item);
}
