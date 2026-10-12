import type { ActivityLevel, Goal } from '../data/schemas/profile';

/** Obiettivi: lista chiusa (M7), nell'ordine in cui si scelgono. */
export const GOALS: readonly { key: Goal; label: string }[] = [
  { key: 'lose', label: 'Dimagrimento' },
  { key: 'recomp', label: 'Ricomposizione' },
  { key: 'gain', label: 'Massa' },
  { key: 'maintain', label: 'Mantenimento' },
];

export function goalLabel(goal: Goal | null): string | null {
  return GOALS.find((g) => g.key === goal)?.label ?? null;
}

/** Livelli di vita quotidiana per la stima delle kcal (§ 6.1). */
export const ACTIVITY_LEVELS: readonly { key: ActivityLevel; label: string; hint: string }[] = [
  { key: 'sedentary', label: 'Sedentario', hint: 'lavoro seduto, poco movimento fuori dagli allenamenti' },
  { key: 'active', label: 'Attivo', hint: 'molte ore in piedi o in movimento' },
];

export function activityLabel(level: ActivityLevel): string {
  return ACTIVITY_LEVELS.find((a) => a.key === level)?.label ?? '';
}
