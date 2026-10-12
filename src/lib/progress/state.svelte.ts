import type { PeriodKey } from './period';
import type { StrengthMetric } from './strength';

export type { StrengthMetric };

/**
 * Scelte della schermata Progressi (tab, periodo, esercizio, Carico/Volume, Grafico/Tabella), ricordate
 * in memoria finché l'app è aperta (scelta confermata in M9): Progressi non scrive mai nel database.
 */

export type ProgressTab = 'corpo' | 'forza' | 'dieta';
export type CardView = 'chart' | 'table';

export const PROGRESS_TABS: readonly { id: ProgressTab; label: string }[] = [
  { id: 'corpo', label: 'Corpo' },
  { id: 'forza', label: 'Forza' },
  { id: 'dieta', label: 'Dieta' },
];

export const progressView = $state({
  tab: 'corpo' as ProgressTab,
  period: 'all' as PeriodKey,
  /** Chiave dell'esercizio (`exerciseKey`); `null` = il primo dell'elenco. */
  exercise: null as string | null,
  metric: 'load' as StrengthMetric,
  /** Vista di ogni card (chiave della card → grafico o tabella). */
  views: {} as Record<string, CardView>,
});

/** Tab da un parametro dell'indirizzo (`#/progressi?tab=corpo`); `null` se non è una tab. */
export function parseTab(value: string | null | undefined): ProgressTab | null {
  return PROGRESS_TABS.some((t) => t.id === value) ? (value as ProgressTab) : null;
}
