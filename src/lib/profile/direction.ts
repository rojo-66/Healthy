import type { Goal } from '../data/schemas/profile';
import type { MetricKey } from './metrics';

/**
 * Colore di una variazione (SPEC § 5.6): ciano = direzione giusta, giallo = da tenere d'occhio,
 * grigio = neutra. Non è una valutazione medica: serve solo a colorare (tabella confermata in M7).
 * - `up`: aumento ciano, calo giallo;
 * - `down`: calo ciano, aumento giallo;
 * - `stable`: oltre `stableBand`, in un senso o nell'altro, giallo;
 * - `none`: sempre grigio.
 * Sotto la soglia la variazione è neutra.
 */

export type Direction = 'up' | 'down' | 'stable' | 'none';
export type DeltaTone = 'good' | 'warn' | 'neutral';

export interface DirectionRule {
  /** |Δ| sotto questa soglia → neutra. */
  threshold: number;
  /** Banda della direzione `stable` (oltre → gialla). */
  stableBand?: number;
  byGoal: Readonly<Record<Goal, Direction>>;
}

const all = (d: Direction): Record<Goal, Direction> => ({ lose: d, recomp: d, gain: d, maintain: d });
const goals = (lose: Direction, recomp: Direction, gain: Direction, maintain: Direction): Record<Goal, Direction> => ({
  lose,
  recomp,
  gain,
  maintain,
});

const WAIST_LIKE: DirectionRule = { threshold: 0.5, stableBand: 1.5, byGoal: goals('down', 'down', 'none', 'stable') };
const LIMB_SMALL: DirectionRule = { threshold: 0.3, byGoal: goals('none', 'up', 'up', 'none') };

export const DIRECTION_RULES: Readonly<Record<MetricKey, DirectionRule>> = {
  weight: { threshold: 0.5, stableBand: 1, byGoal: goals('down', 'none', 'up', 'stable') },
  bmi: { threshold: 0.2, stableBand: 0.3, byGoal: goals('down', 'none', 'up', 'stable') },
  fmKg: { threshold: 0.3, stableBand: 1, byGoal: goals('down', 'down', 'none', 'stable') },
  fmPct: { threshold: 0.5, stableBand: 1, byGoal: goals('down', 'down', 'none', 'stable') },
  ffmKg: { threshold: 0.3, byGoal: all('up') },
  ffmPct: { threshold: 0.5, stableBand: 1, byGoal: goals('up', 'up', 'none', 'stable') },
  bcmKg: { threshold: 0.3, byGoal: all('up') },
  bcmPct: { threshold: 0.5, byGoal: all('up') },
  bcmi: { threshold: 0.1, byGoal: all('up') },
  pha: { threshold: 0.1, byGoal: all('up') },
  bmr: { threshold: 10, byGoal: all('up') },
  tbw: { threshold: 0.5, byGoal: all('none') },
  ecw: { threshold: 0.3, byGoal: all('down') },
  ecwTbw: { threshold: 0.5, byGoal: all('down') },
  chest: { threshold: 0.5, byGoal: goals('none', 'up', 'up', 'none') },
  waist: WAIST_LIKE,
  abdomen: WAIST_LIKE,
  hips: WAIST_LIKE,
  thigh: { threshold: 0.5, byGoal: goals('none', 'up', 'up', 'none') },
  arm: LIMB_SMALL,
  calf: LIMB_SMALL,
};

/** Direzione per un obiettivo; senza obiettivo vale solo se è la stessa per tutti, altrimenti `none`. */
export function directionFor(key: MetricKey, goal: Goal | null): Direction {
  const { byGoal } = DIRECTION_RULES[key];
  if (goal) return byGoal[goal];
  const values = new Set(Object.values(byGoal));
  return values.size === 1 ? [...values][0]! : 'none';
}

const EPS = 1e-9;

/** Tono di una variazione già arrotondata come viene mostrata. */
export function deltaTone(key: MetricKey, goal: Goal | null, delta: number): DeltaTone {
  const rule = DIRECTION_RULES[key];
  const size = Math.abs(delta);
  if (size < rule.threshold - EPS) return 'neutral';
  switch (directionFor(key, goal)) {
    case 'up':
      return delta > 0 ? 'good' : 'warn';
    case 'down':
      return delta < 0 ? 'good' : 'warn';
    case 'stable':
      return size >= (rule.stableBand ?? rule.threshold) - EPS ? 'warn' : 'neutral';
    case 'none':
      return 'neutral';
  }
}
