import { weekdayName, type DietDay, type DietPayload } from '../../data/schemas/diet-payload';
import { formatDecimal, formatInt } from '../format';
import type { Totals } from './nutrients';
import type { ResolvedTargets, TargetOrigin } from './targets';
import { dayHasVegetables } from './vegetables';

/**
 * Osservazioni dell'app su un piano del nutrizionista (§ 6.2): solo segnalazioni, mai modifiche.
 * In M3 tutti i piani sono importati, quindi tutti "del nutrizionista".
 */
export const OBSERVATION_DISCLAIMER = "L'app non modifica il piano: segnala soltanto.";

/** Scarto minimo da segnalare, in percentuale del target. */
export const DEVIATION_THRESHOLD_PCT = 5;

export type ObservationKind = 'deviation' | 'aligned' | 'incomplete' | 'no-vegetables';

export interface Observation {
  kind: ObservationKind;
  text: string;
}

export interface Deviation {
  field: 'kcal' | 'protein' | 'carbs' | 'fat';
  diff: number;
  pct: number;
}

/** Campi confrontati con il target, con nome e unità (usati anche da Progressi, M9). */
export const DEVIATION_FIELDS = [
  { field: 'kcal', name: 'calorie', unit: 'kcal' },
  { field: 'protein', name: 'proteine', unit: 'g' },
  { field: 'carbs', name: 'carboidrati', unit: 'g' },
  { field: 'fat', name: 'grassi', unit: 'g' },
] as const;

const TARGET_PHRASE: Readonly<Record<TargetOrigin, string>> = {
  nutritionist: 'con i target del nutrizionista',
  manual: 'con i target che hai inserito',
  estimated: 'con i target stimati',
  calculated: 'con i target',
};

/** Scarti piano/target dove il target c'è, dal maggiore (in valore assoluto della percentuale). */
export function deviations(plan: Totals, resolved: ResolvedTargets): Deviation[] {
  return DEVIATION_FIELDS.flatMap(({ field }) => {
    const target = resolved.targets[field];
    if (target === null || target <= 0) return [];
    const diff = plan.total[field] - target;
    return [{ field, diff, pct: (diff / target) * 100 }];
  }).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

/** Segno davanti a un numero già scritto: "+120", "−8". */
export function signed(text: string, value: number): string {
  return `${value > 0 ? '+' : '−'}${text}`;
}

/** Osservazioni del giorno: confronto con i target e verdura. */
export function dayObservations(
  payload: DietPayload,
  day: DietDay,
  plan: Totals,
  resolved: ResolvedTargets | null,
): Observation[] {
  const dayName = weekdayName(day.weekday).toLowerCase();
  const list: Observation[] = [];

  if (resolved && resolved.origin !== 'calculated') {
    if (!plan.complete) {
      const n = plan.missing.length;
      list.push({
        kind: 'incomplete',
        text: `Non posso confrontare il piano di ${dayName} con i target: ${n === 1 ? 'un alimento è' : `${n} alimenti sono`} senza valori nutrizionali.`,
      });
    } else {
      const top = deviations(plan, resolved)[0];
      if (top && Math.abs(top.pct) >= DEVIATION_THRESHOLD_PCT) {
        const info = DEVIATION_FIELDS.find((f) => f.field === top.field)!;
        const amount = top.field === 'kcal' ? formatInt(Math.abs(top.diff)) : formatDecimal(Math.abs(top.diff), 1, true);
        list.push({
          kind: 'deviation',
          text: `Il piano di ${dayName} ha ${info.name} ${signed(amount, top.diff)} ${info.unit} rispetto al target (${signed(String(Math.round(Math.abs(top.pct))), top.diff)}%). Se ti sembra strano, chiedi conferma al nutrizionista.`,
        });
      } else if (top) {
        list.push({
          kind: 'aligned',
          text: `Il piano di ${dayName} è in linea ${TARGET_PHRASE[resolved.origin]}: tutti gli scarti sono sotto il ${DEVIATION_THRESHOLD_PCT}%.`,
        });
      }
    }
  }

  if (day.meals.some((meal) => meal.items.length > 0) && !dayHasVegetables(day, payload.products)) {
    list.push({ kind: 'no-vegetables', text: `Nel piano di ${dayName} non c'è verdura.` });
  }
  return list;
}
