import type { Measurement } from '../data/schemas/measurements';
import type { Profile } from '../data/schemas/profile';
import { mifflinStJeor } from '../diet/calc/estimate';
import { ageFromBirthYear } from './age';

/**
 * Parametri del Profilo (SPEC § 5.6, § 6.3). Ogni valore dichiara la sua origine:
 * - `measured`: inserito dall'utente (bioimpedenza, bilancia, metro);
 * - `calculated`: ricavato dagli altri valori della stessa misura (BMI, FFM = peso − FM…);
 * - `estimated`: stima con una formula (solo il BMR con Mifflin-St Jeor), mai mescolata ai misurati.
 * Un valore misurato non viene mai sostituito da uno calcolato.
 */

export type MetricKey =
  | 'weight'
  | 'bmi'
  | 'bmr'
  | 'pha'
  | 'fmKg'
  | 'fmPct'
  | 'ffmKg'
  | 'ffmPct'
  | 'bcmKg'
  | 'bcmPct'
  | 'bcmi'
  | 'tbw'
  | 'ecw'
  | 'ecwTbw'
  | 'chest'
  | 'waist'
  | 'abdomen'
  | 'hips'
  | 'thigh'
  | 'arm'
  | 'calf';

export type Origin = 'measured' | 'calculated' | 'estimated';

export interface MetricValue {
  value: number;
  origin: Origin;
}

export type DerivedMetrics = Record<MetricKey, MetricValue | null>;

export interface MetricInfo {
  label: string;
  /** Unità mostrata accanto al valore ("" = nessuna). */
  unit: string;
  /** Decimali mostrati (e usati per arrotondare prima di confrontare). */
  digits: number;
  /** È già una percentuale: la variazione si legge in punti ("pt"), non in % del valore. */
  percent: boolean;
}

export const METRICS: Readonly<Record<MetricKey, MetricInfo>> = {
  weight: { label: 'Peso', unit: 'kg', digits: 1, percent: false },
  bmi: { label: 'BMI', unit: 'kg/m²', digits: 1, percent: false },
  bmr: { label: 'Metabolismo basale BMR', unit: 'kcal', digits: 0, percent: false },
  pha: { label: 'Angolo di fase', unit: '°', digits: 1, percent: false },
  fmKg: { label: 'Massa grassa FM', unit: 'kg', digits: 1, percent: false },
  fmPct: { label: 'Massa grassa FM', unit: '%', digits: 1, percent: true },
  ffmKg: { label: 'Massa magra FFM', unit: 'kg', digits: 1, percent: false },
  ffmPct: { label: 'Massa magra FFM', unit: '%', digits: 1, percent: true },
  bcmKg: { label: 'Massa cellulare BCM', unit: 'kg', digits: 1, percent: false },
  bcmPct: { label: 'Massa cellulare BCM su FFM', unit: '%', digits: 1, percent: true },
  bcmi: { label: 'BCMI', unit: 'kg/m²', digits: 1, percent: false },
  tbw: { label: 'Acqua totale TBW', unit: 'L', digits: 1, percent: false },
  ecw: { label: 'Acqua extracellulare ECW', unit: 'L', digits: 1, percent: false },
  ecwTbw: { label: 'ECW / TBW', unit: '%', digits: 1, percent: true },
  chest: { label: 'Torace', unit: 'cm', digits: 1, percent: false },
  waist: { label: 'Vita', unit: 'cm', digits: 1, percent: false },
  abdomen: { label: 'Addome', unit: 'cm', digits: 1, percent: false },
  hips: { label: 'Fianchi', unit: 'cm', digits: 1, percent: false },
  thigh: { label: 'Coscia', unit: 'cm', digits: 1, percent: false },
  arm: { label: 'Braccio', unit: 'cm', digits: 1, percent: false },
  calf: { label: 'Polpaccio', unit: 'cm', digits: 1, percent: false },
};

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

/** Circonferenze nell'ordine del mockup, con il campo della misura. */
export const CIRCUMFERENCES = [
  ['chest', 'chestCm'],
  ['waist', 'waistCm'],
  ['abdomen', 'abdomenCm'],
  ['hips', 'hipsCm'],
  ['thigh', 'thighCm'],
  ['arm', 'armCm'],
  ['calf', 'calfCm'],
] as const satisfies readonly (readonly [MetricKey, keyof Measurement])[];

/** Valore arrotondato come viene mostrato (i confronti usano questo, non il valore grezzo). */
export function roundFor(key: MetricKey, value: number): number {
  const factor = 10 ** METRICS[key].digits;
  return Math.round(value * factor) / factor;
}

const measured = (value: number | null): MetricValue | null => (value === null ? null : { value, origin: 'measured' });
const calculated = (value: number | null): MetricValue | null =>
  value === null || !Number.isFinite(value) || value < 0 ? null : { value, origin: 'calculated' };

/** Altezza in metri al quadrato; `null` senza altezza. */
function heightSquared(heightCm: number | null | undefined): number | null {
  return heightCm ? (heightCm / 100) ** 2 : null;
}

export type ProfileForMetrics = Pick<Profile, 'heightCm' | 'sex' | 'birthYear'>;

/** Tutti i parametri di una misura: quelli inseriti più quelli che se ne ricavano (SPEC § 6.3). */
export function deriveMetrics(m: Measurement, profile: ProfileForMetrics | undefined): DerivedMetrics {
  const weight = m.weightKg;
  const h2 = heightSquared(profile?.heightCm);

  // FM: misurata; altrimenti peso − FFM misurata; altrimenti peso × FM% misurata.
  const fmKg =
    measured(m.fmKg) ??
    calculated(weight !== null && m.ffmKg !== null ? weight - m.ffmKg : null) ??
    calculated(weight !== null && m.fmPct !== null ? (weight * m.fmPct) / 100 : null);
  // FFM: misurata; altrimenti peso − FM (la FM qui non può venire dalla FFM, che manca).
  const ffmKg = measured(m.ffmKg) ?? calculated(weight !== null && fmKg ? weight - fmKg.value : null);

  const pctOfWeight = (part: MetricValue | null) =>
    calculated(part && weight ? (part.value / weight) * 100 : null);
  const fmPct = measured(m.fmPct) ?? pctOfWeight(fmKg);
  const ffmPct = pctOfWeight(ffmKg) ?? calculated(m.fmPct !== null ? 100 - m.fmPct : null);

  const bcmKg = measured(m.bcmKg);
  // Decisione M7: BCM% si riferisce alla massa magra, non al peso.
  const bcmPct = calculated(bcmKg && ffmKg && ffmKg.value > 0 ? (bcmKg.value / ffmKg.value) * 100 : null);

  const tbw = measured(m.tbwL);
  const ecw = measured(m.ecwL);
  const ecwTbw = calculated(ecw && tbw && tbw.value > 0 ? (ecw.value / tbw.value) * 100 : null);

  const bmr = measured(m.bmrKcal) ?? estimatedBmr(m, profile);

  return {
    weight: measured(weight),
    bmi: calculated(weight !== null && h2 ? weight / h2 : null),
    bmr,
    pha: measured(m.phaDeg),
    fmKg,
    fmPct,
    ffmKg,
    ffmPct,
    bcmKg,
    bcmPct,
    bcmi: calculated(bcmKg && h2 ? bcmKg.value / h2 : null),
    tbw,
    ecw,
    ecwTbw,
    chest: measured(m.chestCm),
    waist: measured(m.waistCm),
    abdomen: measured(m.abdomenCm),
    hips: measured(m.hipsCm),
    thigh: measured(m.thighCm),
    arm: measured(m.armCm),
    calf: measured(m.calfCm),
  };
}

/** BMR stimato (Mifflin-St Jeor) con l'età nell'anno della misura; serve sesso, anno di nascita, altezza e peso. */
function estimatedBmr(m: Measurement, profile: ProfileForMetrics | undefined): MetricValue | null {
  const age = ageFromBirthYear(profile?.birthYear, m.date);
  if (!profile?.sex || !profile.heightCm || m.weightKg === null || age === null) return null;
  const value = Math.round(mifflinStJeor({ sex: profile.sex, age, heightCm: profile.heightCm, weightKg: m.weightKg }));
  return value > 0 ? { value, origin: 'estimated' } : null;
}

/** Ultimo peso inserito (le misure senza peso si saltano); elenco in qualsiasi ordine. */
export function latestWeight(measurements: readonly Pick<Measurement, 'date' | 'weightKg'>[]): number | null {
  let best: { date: string; weightKg: number } | null = null;
  for (const m of measurements) {
    if (m.weightKg !== null && (best === null || m.date > best.date)) best = { date: m.date, weightKg: m.weightKg };
  }
  return best?.weightKg ?? null;
}
