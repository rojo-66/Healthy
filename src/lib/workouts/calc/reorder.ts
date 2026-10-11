/** Elenco con l'elemento `from` spostato in posizione `to` (nuovo array; indici fuori range = nessun cambio). */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item as T);
  return out;
}

/**
 * Posizione d'arrivo durante il trascinamento: l'elemento `from` è spostato di `dy` px;
 * supera un vicino quando il suo centro oltrepassa la metà di quel vicino.
 * `heights` = altezze delle righe (gap compreso), nell'ordine attuale.
 */
export function dropIndex(dy: number, heights: readonly number[], from: number): number {
  let index = from;
  if (dy > 0) {
    let travelled = dy;
    for (let i = from + 1; i < heights.length; i++) {
      const half = (heights[i] ?? 0) / 2;
      if (travelled < half) break;
      index = i;
      travelled -= heights[i] ?? 0;
    }
  } else if (dy < 0) {
    let travelled = -dy;
    for (let i = from - 1; i >= 0; i--) {
      const half = (heights[i] ?? 0) / 2;
      if (travelled < half) break;
      index = i;
      travelled -= heights[i] ?? 0;
    }
  }
  return index;
}

/**
 * Spostamento (px) di ogni riga mentre `from` è trascinata verso `to`:
 * le righe tra le due posizioni scivolano di un posto per lasciare spazio.
 */
export function shiftFor(index: number, from: number, to: number, draggedHeight: number): number {
  if (from < to && index > from && index <= to) return -draggedHeight;
  if (from > to && index < from && index >= to) return draggedHeight;
  return 0;
}
