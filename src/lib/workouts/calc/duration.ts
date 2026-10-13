/** Tempo stimato di una serie (esecuzione), oltre al recupero (SPEC § 5.3). */
export const SET_WORK_SEC = 45;

export interface TimedStrength {
  kind: 'strength';
  sets: number;
  restSec: number;
}

export interface TimedCardio {
  kind: 'cardio';
  name: string;
  minutes: number;
}

export type TimedItem = TimedStrength | TimedCardio;

export interface WorkoutTotals {
  /** Esercizi di forza. */
  exercises: number;
  /** Esercizi cardio (2a). */
  cardio: number;
  /** Serie (solo forza). */
  sets: number;
  /** Minuti della forza: Σ serie × (recupero + 45 s), arrotondati. */
  strengthMin: number;
  /** Minuti del cardio: Σ minuti previsti (0 se non c'è). */
  cardioMin: number;
  /** Durata stimata = forza + cardio. */
  totalMin: number;
}

/** Secondi stimati di un esercizio di forza: serie × (recupero + 45 s). */
export function itemSeconds(item: Pick<TimedStrength, 'sets' | 'restSec'>): number {
  return Math.max(0, item.sets) * (Math.max(0, item.restSec) + SET_WORK_SEC);
}

/** Totali della scheda, da ricalcolare a ogni modifica (contatori dell'editor, card dell'elenco). */
export function workoutTotals(workout: { items: readonly TimedItem[] }): WorkoutTotals {
  let sets = 0;
  let seconds = 0;
  let exercises = 0;
  let cardio = 0;
  let cardioMin = 0;
  for (const item of workout.items) {
    if (item.kind === 'cardio') {
      cardio++;
      cardioMin += Math.max(0, item.minutes);
    } else {
      exercises++;
      sets += Math.max(0, item.sets);
      seconds += itemSeconds(item);
    }
  }
  const strengthMin = Math.round(seconds / 60);
  return { exercises, cardio, sets, strengthMin, cardioMin, totalMin: strengthMin + cardioMin };
}

/** "+ 12’ Tapis roulant · corsa" con un solo cardio, "+ 25’ cardio" con più cardio; `''` senza. */
export function cardioSuffix(items: readonly TimedItem[]): string {
  const cardio = items.filter((i): i is TimedCardio => i.kind === 'cardio' && i.minutes > 0);
  if (cardio.length === 0) return '';
  const min = cardio.reduce((sum, c) => sum + c.minutes, 0);
  return cardio.length === 1 ? `+ ${min}’ ${cardio[0]?.name ?? 'cardio'}` : `+ ${min}’ cardio`;
}
