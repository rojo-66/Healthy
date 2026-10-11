import { lookup } from '../../data/errors';
import type { DietDay, DietPayload, TargetsSource } from '../../data/schemas/diet-payload';
import { dayTotals, type Totals } from './nutrients';

/** Origine di un target, sempre dichiarata accanto al numero (§ 6.1). */
export type TargetOrigin = 'nutritionist' | 'manual' | 'estimated' | 'calculated';

export const TARGET_ORIGIN_LABELS: Readonly<Record<TargetOrigin, string>> = {
  nutritionist: 'TARGET: NUTRIZIONISTA',
  manual: 'TARGET: INSERITO DA TE',
  estimated: 'TARGET: STIMATO',
  calculated: 'TARGET: CALCOLATO',
};

/** Origine in forma di frase (Home: "Target del nutrizionista · giorno palestra"). */
export const TARGET_ORIGIN_TEXT: Readonly<Record<TargetOrigin, string>> = {
  nutritionist: 'Target del nutrizionista',
  manual: 'Target inserito da te',
  estimated: 'Target stimato',
  calculated: 'Target calcolato dal piano',
};

const ORIGIN_OF_SOURCE: Readonly<Record<TargetsSource, TargetOrigin>> = {
  plan: 'nutritionist',
  manual: 'manual',
  estimated: 'estimated',
};

/** Target di un giorno: `null` dove il valore manca (mai inventato). */
export interface DayTargets {
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

export interface ResolvedTargets {
  targets: DayTargets;
  origin: TargetOrigin;
}

/**
 * Target di un giorno, con la priorità di § 6.1:
 * 1. target del tipo di giornata (dal nutrizionista, o inseriti/stimati nel completamento guidato), così come sono;
 * 2. calcolati dal piano: somma degli alimenti, solo se tutti hanno i valori;
 * 3. stimati: solo se accettati nel completamento guidato (finiscono nel caso 1 con origine "stimato").
 * `null` se non si può dire niente di onesto.
 */
export function resolveTargets(payload: DietPayload, day: DietDay, planTotals?: Totals): ResolvedTargets | null {
  const dayType = day.type === null ? undefined : lookup(payload.dayTypes, day.type);
  if (dayType?.targets) {
    return { targets: { ...dayType.targets }, origin: ORIGIN_OF_SOURCE[dayType.targetsSource] };
  }
  const totals = planTotals ?? dayTotals(day, payload.products);
  if (totals.itemCount === 0 || !totals.complete) return null;
  const { kcal, protein, carbs, fat, fiber } = totals.total;
  return {
    targets: { kcal, protein, carbs, fat, fiber: totals.fiberMissing.length === 0 ? fiber : null },
    origin: 'calculated',
  };
}
