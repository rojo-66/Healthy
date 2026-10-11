import type { Goal, Profile } from '../../data/schemas/profile';
import { formatInt } from '../format';

/**
 * Stima delle kcal (§ 6.1, punto 3): BMR con Mifflin-St Jeor × fattore di attività del tipo di giornata,
 * corretto per l'obiettivo, con limiti di sicurezza. Solo kcal: i macro non si stimano (restano mancanti).
 */

export interface EstimateInput {
  sex: 'M' | 'F';
  age: number;
  heightCm: number;
  weightKg: number;
  goal: Goal | null;
}

/** Fattori di attività per i tipi di giornata noti. Gli altri tipi non si stimano. */
export const ACTIVITY_FACTORS: Readonly<Record<string, number>> = { rest: 1.2, run: 1.45, gym: 1.55 };

/** Calorie minime sotto cui la stima non scende mai. */
export const MIN_KCAL: Readonly<Record<'M' | 'F', number>> = { M: 1500, F: 1200 };

const LOSE_PCT = 0.15;
const LOSE_MAX_KCAL = 500;
const GAIN_PCT = 0.1;

/** BMR (kcal/giorno) con Mifflin-St Jeor. */
export function mifflinStJeor({ sex, age, heightCm, weightKg }: Omit<EstimateInput, 'goal'>): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'M' ? 5 : -161);
}

export interface KcalEstimate {
  kcal: number;
  bmr: number;
  factor: number;
  /** Avvisi da mostrare accanto alla stima (minimo di sicurezza, obiettivo irrealistico). */
  warnings: string[];
}

/** Stima per un tipo di giornata; `null` se il tipo non ha un fattore di attività. */
export function estimateKcal(input: EstimateInput, dayTypeKey: string): KcalEstimate | null {
  if (!Object.hasOwn(ACTIVITY_FACTORS, dayTypeKey)) return null;
  const factor = ACTIVITY_FACTORS[dayTypeKey] ?? 1;
  const bmr = mifflinStJeor(input);
  const maintenance = bmr * factor;
  let kcal = maintenance;
  if (input.goal === 'lose') kcal -= Math.min(maintenance * LOSE_PCT, LOSE_MAX_KCAL);
  if (input.goal === 'gain') kcal += maintenance * GAIN_PCT;

  const warnings: string[] = [];
  const min = MIN_KCAL[input.sex];
  if (kcal < min) {
    kcal = min;
    warnings.push(
      `La stima scende sotto il minimo di sicurezza: uso ${formatInt(min)} kcal. Un obiettivo così va concordato con il nutrizionista.`,
    );
  }
  return { kcal: Math.round(kcal / 10) * 10, bmr: Math.round(bmr), factor, warnings };
}

/** Dati per la stima dal profilo e dall'ultimo peso; se manca qualcosa, l'elenco di cosa manca. */
export function estimateInputFrom(
  profile: Profile | undefined,
  weightKg: number | null | undefined,
  today: Date,
): { ok: true; value: EstimateInput } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (!profile?.birthYear) missing.push('età');
  if (!profile?.heightCm) missing.push('altezza');
  if (!weightKg) missing.push('peso');
  if (!profile?.sex) missing.push('sesso');
  if (!profile || !profile.birthYear || !profile.heightCm || !profile.sex || !weightKg) return { ok: false, missing };
  return {
    ok: true,
    value: {
      sex: profile.sex,
      age: today.getFullYear() - profile.birthYear,
      heightCm: profile.heightCm,
      weightKg,
      goal: profile.goal,
    },
  };
}
