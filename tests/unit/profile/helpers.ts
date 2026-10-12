import type { Measurement } from '../../../src/lib/data/schemas/measurements';
import type { Profile } from '../../../src/lib/data/schemas/profile';

/** Misura vuota (tutti i valori `null`) con i valori indicati. Numeri inventati. */
export function measurement(values: Partial<Measurement> = {}): Measurement {
  return {
    id: 'm1',
    date: '2026-09-25',
    weightKg: null,
    fmKg: null,
    fmPct: null,
    ffmKg: null,
    bcmKg: null,
    tbwL: null,
    ecwL: null,
    phaDeg: null,
    bmrKcal: null,
    chestCm: null,
    waistCm: null,
    abdomenCm: null,
    hipsCm: null,
    thighCm: null,
    armCm: null,
    calfCm: null,
    notes: '',
    ...values,
  };
}

export const PROFILE: Profile = {
  id: 'me',
  name: 'Persona di prova',
  birthYear: 1990,
  sex: 'M',
  heightCm: 180,
  goal: 'recomp',
  activityLevel: 'sedentary',
};
