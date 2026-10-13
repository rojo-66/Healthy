import type { DayState } from '../../lib/workouts/calc/week';

/** Etichetta dello stato di un giorno (dettaglio sotto la striscia Settimana). */
export function dayStateLabel(state: DayState, nextInDays: number | null): string {
  switch (state) {
    case 'done':
      return 'FATTO ✓';
    case 'partial':
      return 'IN PARTE';
    case 'skipped':
      return 'SALTATO';
    case 'next':
      return nextInDays === 0 ? 'OGGI' : nextInDays === 1 ? 'DOMANI' : 'PROSSIMO';
    case 'todo':
      return 'IN PROGRAMMA';
    case 'missed':
      return 'NON FATTO';
    case 'rest':
      return 'RIPOSO';
  }
}
