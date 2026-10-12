import { MAX_TEXT } from '../data/limits';
import type { ActivityLevel, Goal, Profile } from '../data/schemas/profile';
import { formatDecimal } from '../diet/format';
import { ageFromBirthYear, PLAUSIBLE } from './age';
import { numberToField, parseDecimalInput } from './number';

/** Modulo del profilo (bottom sheet): errori bloccanti per campo, avvisi gialli che non bloccano. */

export interface ProfileForm {
  name: string;
  birthYear: string;
  sex: 'M' | 'F' | null;
  height: string;
  goal: Goal | null;
  activityLevel: ActivityLevel;
}

export type ProfileFormErrors = Partial<Record<'name' | 'birthYear' | 'height', string>>;

export interface ProfileFormResult {
  value: Omit<Profile, 'id'> | null;
  errors: ProfileFormErrors;
  warnings: string[];
}

const MIN_YEAR = 1900;
const HEIGHT = { min: 50, max: 250 } as const;

export function profileFormFrom(p: Profile | undefined): ProfileForm {
  return {
    name: p?.name ?? '',
    birthYear: p?.birthYear ? String(p.birthYear) : '',
    sex: p?.sex ?? null,
    height: numberToField(p?.heightCm),
    goal: p?.goal ?? null,
    activityLevel: p?.activityLevel ?? 'sedentary',
  };
}

export function readProfileForm(form: ProfileForm, today: Date): ProfileFormResult {
  const errors: ProfileFormErrors = {};
  const warnings: string[] = [];

  const name = form.name.trim();
  if (name.length > MAX_TEXT.name) errors.name = `Al massimo ${MAX_TEXT.name} caratteri.`;

  let birthYear: number | null = null;
  const year = form.birthYear.trim();
  if (year !== '') {
    if (!/^\d{4}$/.test(year)) {
      errors.birthYear = "Scrivi l'anno a 4 cifre, es. 1990.";
    } else if (Number(year) > today.getFullYear()) {
      errors.birthYear = "L'anno di nascita è nel futuro.";
    } else if (Number(year) < MIN_YEAR) {
      errors.birthYear = `Anno non valido: dal ${MIN_YEAR} in poi.`;
    } else {
      birthYear = Number(year);
      const age = ageFromBirthYear(birthYear, today) ?? 0;
      if (age < PLAUSIBLE.age.min || age > PLAUSIBLE.age.max) {
        warnings.push(`Età di ${age} anni: controlla l'anno di nascita.`);
      }
    }
  }

  let heightCm: number | null = null;
  const parsed = parseDecimalInput(form.height);
  if (!parsed.ok) {
    errors.height = parsed.error;
  } else if (parsed.value !== null) {
    if (parsed.value < 3) {
      errors.height = "Scrivi l'altezza in centimetri, es. 178.";
    } else if (parsed.value < HEIGHT.min || parsed.value > HEIGHT.max) {
      errors.height = `Altezza in centimetri, tra ${HEIGHT.min} e ${HEIGHT.max}.`;
    } else {
      // Al millimetro basta: 178,25 → 178,3.
      heightCm = Math.round(parsed.value * 10) / 10;
      if (heightCm < PLAUSIBLE.heightCm.min || heightCm > PLAUSIBLE.heightCm.max) {
        warnings.push(`Altezza di ${formatDecimal(heightCm, 1, true)} cm: controlla il valore.`);
      }
    }
  }

  const ok = Object.keys(errors).length === 0;
  return {
    value: ok ? { name, birthYear, sex: form.sex, heightCm, goal: form.goal, activityLevel: form.activityLevel } : null,
    errors,
    warnings,
  };
}
