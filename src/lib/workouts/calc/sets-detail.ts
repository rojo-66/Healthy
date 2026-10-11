import { clampSets } from './values';

/** Serie piramidali ("Serie diverse tra loro"): un dettaglio kg/ripetizioni per ogni serie. */
export interface SetDetail {
  reps: number;
  kg: number;
}

export interface PyramidItem {
  sets: number;
  reps: number;
  kg: number;
  setsDetail: SetDetail[] | null;
  /** Dettaglio dell'ultima disattivazione (solo nella bozza): riattivando si ritrova. */
  setsDetailMemory?: SetDetail[] | null;
}

/**
 * Attiva le serie diverse. Riprende il dettaglio in memoria (adattato al numero di serie) solo se
 * nel frattempo i valori uniformi non sono cambiati; altrimenti ogni serie parte dai valori uniformi.
 */
export function enablePyramid<T extends PyramidItem>(item: T): T {
  if (item.setsDetail) return item;
  const memory = item.setsDetailMemory;
  const usable = !!memory && memory.length > 0 && memory[0]!.reps === item.reps && memory[0]!.kg === item.kg;
  const base = usable ? memory : [{ reps: item.reps, kg: item.kg }];
  const detail = resize(base, item.sets);
  const first = detail[0] ?? { reps: item.reps, kg: item.kg };
  return { ...item, setsDetail: detail, setsDetailMemory: null, reps: first.reps, kg: first.kg };
}

/** Le serie sono davvero diverse? Se sì, disattivando si perde qualcosa: l'editor chiede conferma. */
export function pyramidDiffers(item: PyramidItem): boolean {
  const detail = item.setsDetail;
  if (!detail || detail.length === 0) return false;
  const first = detail[0]!;
  return detail.some((s) => s.reps !== first.reps || s.kg !== first.kg);
}

/** Torna a serie uniformi con kg e ripetizioni della serie 1; il dettaglio resta in memoria. */
export function disablePyramid<T extends PyramidItem>(item: T): T {
  const detail = item.setsDetail;
  if (!detail) return item;
  const first = detail[0] ?? { reps: item.reps, kg: item.kg };
  return { ...item, setsDetail: null, setsDetailMemory: detail, reps: first.reps, kg: first.kg };
}

/** Cambia il numero di serie: con il dettaglio si copia l'ultima serie o si tolgono le ultime. */
export function setSetsCount<T extends PyramidItem>(item: T, sets: number): T {
  const n = clampSets(sets);
  if (!item.setsDetail) return { ...item, sets: n };
  return { ...item, sets: n, setsDetail: resize(item.setsDetail, n) };
}

/** Modifica una serie del dettaglio; la serie 1 resta anche il valore "uniforme" dell'esercizio. */
export function updateSetDetail<T extends PyramidItem>(item: T, index: number, patch: Partial<SetDetail>): T {
  const detail = item.setsDetail;
  if (!detail || index < 0 || index >= detail.length) return item;
  const next = detail.map((s, i) => (i === index ? { ...s, ...patch } : s));
  const first = next[0]!;
  return { ...item, setsDetail: next, reps: first.reps, kg: first.kg };
}

/** Uniforme: aggiorna kg/ripetizioni; con il dettaglio attivo cambia la serie 1. */
export function setUniform<T extends PyramidItem>(item: T, patch: Partial<SetDetail>): T {
  if (item.setsDetail) return updateSetDetail(item, 0, patch);
  return { ...item, ...patch };
}

function resize(detail: readonly SetDetail[], n: number): SetDetail[] {
  const out = detail.slice(0, n).map((s) => ({ ...s }));
  const last = out[out.length - 1] ?? { reps: 0, kg: 0 };
  while (out.length < n) out.push({ ...last });
  return out;
}
