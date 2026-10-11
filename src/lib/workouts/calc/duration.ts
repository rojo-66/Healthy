/** Tempo stimato di una serie (esecuzione), oltre al recupero (SPEC § 5.3). */
export const SET_WORK_SEC = 45;

export interface TimedItem {
  sets: number;
  restSec: number;
}

export interface WorkoutTotals {
  exercises: number;
  sets: number;
  /** Minuti degli esercizi: Σ serie × (recupero + 45 s), arrotondati. */
  strengthMin: number;
  /** Minuti del cardio finale (0 se non c'è). */
  cardioMin: number;
  /** Durata stimata = esercizi + cardio. */
  totalMin: number;
}

/** Secondi stimati di un esercizio: serie × (recupero + 45 s). */
export function itemSeconds(item: TimedItem): number {
  return Math.max(0, item.sets) * (Math.max(0, item.restSec) + SET_WORK_SEC);
}

/** Totali della scheda, da ricalcolare a ogni modifica (contatori dell'editor, card dell'elenco). */
export function workoutTotals(workout: {
  items: readonly TimedItem[];
  cardio: { minutes: number } | null;
}): WorkoutTotals {
  let sets = 0;
  let seconds = 0;
  for (const item of workout.items) {
    sets += Math.max(0, item.sets);
    seconds += itemSeconds(item);
  }
  const strengthMin = Math.round(seconds / 60);
  const cardioMin = Math.max(0, workout.cardio?.minutes ?? 0);
  return { exercises: workout.items.length, sets, strengthMin, cardioMin, totalMin: strengthMin + cardioMin };
}
