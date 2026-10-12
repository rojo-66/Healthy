import type { ActivityLevel, Goal, Profile } from '../../data/schemas/profile';
import { ADULT_AGE, ageFromBirthYear, PLAUSIBLE } from '../../profile/age';
import { formatInt } from '../format';

/**
 * Stima delle kcal (§ 6.1, punto 3): BMR con Mifflin-St Jeor × fattore di attività (tipo di giornata
 * + livello di vita quotidiana del Profilo), corretto per l'obiettivo, con limiti di sicurezza.
 * Solo kcal: i macro non si stimano (restano mancanti). È sempre un'opzione: non si applica da sola.
 */

export interface EstimateInput {
  sex: 'M' | 'F';
  age: number;
  heightCm: number;
  weightKg: number;
  goal: Goal | null;
  /** Predefinito: sedentario (= fattori di M3). */
  activityLevel?: ActivityLevel;
}

/** Fattori di attività (sedentario) per i tipi di giornata noti. Gli altri tipi non si stimano. */
export const ACTIVITY_FACTORS: Readonly<Record<string, number>> = { rest: 1.2, run: 1.45, gym: 1.55 };

/** Quanto aggiunge il livello di vita quotidiana a ogni tipo di giornata (M7). */
export const ACTIVITY_LEVEL_BONUS: Readonly<Record<ActivityLevel, number>> = { sedentary: 0, active: 0.15 };

/** Calorie minime sotto cui la stima non scende mai. */
export const MIN_KCAL: Readonly<Record<'M' | 'F', number>> = { M: 1500, F: 1200 };

const LOSE_PCT = 0.15;
const LOSE_MAX_KCAL = 500;
const GAIN_PCT = 0.1;

/** BMR (kcal/giorno) con Mifflin-St Jeor. */
export function mifflinStJeor({ sex, age, heightCm, weightKg }: Pick<EstimateInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'M' ? 5 : -161);
}

/** Fattore per tipo di giornata e livello (es. palestra + attivo = 1,7); `null` per i tipi senza fattore. */
export function activityFactor(dayTypeKey: string, level: ActivityLevel = 'sedentary'): number | null {
  if (!Object.hasOwn(ACTIVITY_FACTORS, dayTypeKey)) return null;
  return Math.round(((ACTIVITY_FACTORS[dayTypeKey] ?? 1) + ACTIVITY_LEVEL_BONUS[level]) * 100) / 100;
}

export interface KcalEstimate {
  kcal: number;
  bmr: number;
  factor: number;
  /** Avvisi da mostrare accanto alla stima (minimo di sicurezza, dati poco adatti alla formula). */
  warnings: string[];
}

/** Stima per un tipo di giornata; `null` se il tipo non ha un fattore di attività. */
export function estimateKcal(input: EstimateInput, dayTypeKey: string): KcalEstimate | null {
  const factor = activityFactor(dayTypeKey, input.activityLevel);
  if (factor === null) return null;
  const bmr = mifflinStJeor(input);
  const maintenance = bmr * factor;
  let kcal = maintenance;
  if (input.goal === 'lose') kcal -= Math.min(maintenance * LOSE_PCT, LOSE_MAX_KCAL);
  if (input.goal === 'gain') kcal += maintenance * GAIN_PCT;

  const warnings: string[] = [];
  if (input.age < ADULT_AGE) {
    warnings.push('La formula è pensata per gli adulti: sotto i 18 anni la stima è poco affidabile.');
  }
  if (!plausible(input)) {
    warnings.push('Età, altezza o peso sono fuori dai valori abituali: controlla il Profilo, la stima è poco affidabile.');
  }
  const min = MIN_KCAL[input.sex];
  if (kcal < min) {
    kcal = min;
    warnings.push(
      `La stima scende sotto il minimo di sicurezza: uso ${formatInt(min)} kcal. Un obiettivo così va concordato con il nutrizionista.`,
    );
  }
  return { kcal: Math.round(kcal / 10) * 10, bmr: Math.round(bmr), factor, warnings };
}

function plausible({ age, heightCm, weightKg }: EstimateInput): boolean {
  const within = (v: number, r: { min: number; max: number }) => v >= r.min && v <= r.max;
  return within(age, PLAUSIBLE.age) && within(heightCm, PLAUSIBLE.heightCm) && within(weightKg, PLAUSIBLE.weightKg);
}

/**
 * Dati per la stima dal profilo e dall'ultimo peso inserito; se manca qualcosa, l'elenco di cosa manca.
 * L'età viene dall'anno di nascita (± 1 anno, vedi `profile/age.ts`).
 */
export function estimateInputFrom(
  profile: Profile | undefined,
  weightKg: number | null | undefined,
  today: Date,
): { ok: true; value: EstimateInput } | { ok: false; missing: string[] } {
  const age = ageFromBirthYear(profile?.birthYear, today);
  const missing: string[] = [];
  if (age === null) missing.push('età');
  if (!profile?.heightCm) missing.push('altezza');
  if (!weightKg) missing.push('peso');
  if (!profile?.sex) missing.push('sesso');
  if (!profile || age === null || !profile.heightCm || !profile.sex || !weightKg) return { ok: false, missing };
  return {
    ok: true,
    value: {
      sex: profile.sex,
      age,
      heightCm: profile.heightCm,
      weightKg,
      goal: profile.goal,
      activityLevel: profile.activityLevel,
    },
  };
}
