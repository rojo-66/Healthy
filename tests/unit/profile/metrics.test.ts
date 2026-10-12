import { describe, expect, it } from 'vitest';
import { ageFromBirthYear } from '../../../src/lib/profile/age';
import { deriveMetrics, latestWeight, roundFor } from '../../../src/lib/profile/metrics';
import { measurement, PROFILE } from './helpers';

describe('formule (SPEC § 6.3)', () => {
  it('BMI = peso / altezza²: 80 kg e 180 cm → 24,7', () => {
    const m = deriveMetrics(measurement({ weightKg: 80 }), PROFILE);
    expect(roundFor('bmi', m.bmi!.value)).toBe(24.7);
    expect(m.bmi!.origin).toBe('calculated');
  });

  it('BCM% = BCM / FFM × 100 (sulla massa magra, non sul peso): 32 su 64 → 50 %', () => {
    const m = deriveMetrics(measurement({ weightKg: 80, ffmKg: 64, bcmKg: 32 }), PROFILE);
    expect(m.bcmPct).toEqual({ value: 50, origin: 'calculated' });
  });

  it('BCMI = BCM / altezza²: 30 kg e 180 cm → 9,3', () => {
    const m = deriveMetrics(measurement({ bcmKg: 30 }), PROFILE);
    expect(roundFor('bcmi', m.bcmi!.value)).toBe(9.3);
  });

  it('senza altezza niente BMI né BCMI', () => {
    const m = deriveMetrics(measurement({ weightKg: 80, bcmKg: 30 }), { ...PROFILE, heightCm: null });
    expect(m.bmi).toBeNull();
    expect(m.bcmi).toBeNull();
    expect(deriveMetrics(measurement({ weightKg: 80 }), undefined).bmi).toBeNull();
  });

  it('ECW/TBW in %', () => {
    const m = deriveMetrics(measurement({ tbwL: 45, ecwL: 18 }), PROFILE);
    expect(m.ecwTbw).toEqual({ value: 40, origin: 'calculated' });
    expect(deriveMetrics(measurement({ ecwL: 18 }), PROFILE).ecwTbw).toBeNull();
  });
});

describe('FM e FFM: misurate o calcolate', () => {
  it('manca la FFM: FFM = peso − FM, percentuali sul peso', () => {
    const m = deriveMetrics(measurement({ weightKg: 80, fmKg: 16 }), PROFILE);
    expect(m.fmKg).toEqual({ value: 16, origin: 'measured' });
    expect(m.ffmKg).toEqual({ value: 64, origin: 'calculated' });
    expect(m.fmPct).toEqual({ value: 20, origin: 'calculated' });
    expect(m.ffmPct).toEqual({ value: 80, origin: 'calculated' });
  });

  it('manca la FM: FM = peso − FFM', () => {
    const m = deriveMetrics(measurement({ weightKg: 80, ffmKg: 62 }), PROFILE);
    expect(m.fmKg).toEqual({ value: 18, origin: 'calculated' });
    expect(m.ffmKg).toEqual({ value: 62, origin: 'measured' });
  });

  it('solo FM %: FM kg dal peso, FFM per differenza', () => {
    const m = deriveMetrics(measurement({ weightKg: 80, fmPct: 25 }), PROFILE);
    expect(m.fmPct).toEqual({ value: 25, origin: 'measured' });
    expect(m.fmKg).toEqual({ value: 20, origin: 'calculated' });
    expect(m.ffmKg).toEqual({ value: 60, origin: 'calculated' });
  });

  it('senza peso: FFM % = 100 − FM % misurata, niente kg', () => {
    const m = deriveMetrics(measurement({ fmPct: 22 }), PROFILE);
    expect(m.ffmPct).toEqual({ value: 78, origin: 'calculated' });
    expect(m.fmKg).toBeNull();
    expect(m.ffmKg).toBeNull();
  });

  it('un valore misurato non viene mai sostituito da uno calcolato', () => {
    // FM % misurata (21) diversa da FM / peso (20): resta quella misurata.
    const m = deriveMetrics(measurement({ weightKg: 80, fmKg: 16, fmPct: 21, ffmKg: 63 }), PROFILE);
    expect(m.fmPct).toEqual({ value: 21, origin: 'measured' });
    expect(m.fmKg).toEqual({ value: 16, origin: 'measured' });
    expect(m.ffmKg).toEqual({ value: 63, origin: 'measured' });
  });

  it('un calcolo impossibile (FFM > peso) non produce valori negativi', () => {
    const m = deriveMetrics(measurement({ weightKg: 60, ffmKg: 70 }), PROFILE);
    expect(m.fmKg).toBeNull();
  });
});

describe('BMR: misurato o stimato', () => {
  it('preferisce il valore della bioimpedenza', () => {
    expect(deriveMetrics(measurement({ weightKg: 80, bmrKcal: 1750 }), PROFILE).bmr).toEqual({ value: 1750, origin: 'measured' });
  });

  it('se manca, stima Mifflin-St Jeor con l\'età nell\'anno della misura', () => {
    // 10 × 80 + 6,25 × 180 − 5 × 36 + 5 = 1750
    expect(deriveMetrics(measurement({ weightKg: 80 }), PROFILE).bmr).toEqual({ value: 1750, origin: 'estimated' });
    // Misura del 2024: 34 anni → +10 kcal
    expect(deriveMetrics(measurement({ date: '2024-05-01', weightKg: 80 }), PROFILE).bmr?.value).toBe(1760);
  });

  it('senza sesso, anno, altezza o peso nessuna stima', () => {
    expect(deriveMetrics(measurement({ weightKg: 80 }), { ...PROFILE, sex: null }).bmr).toBeNull();
    expect(deriveMetrics(measurement({ weightKg: 80 }), { ...PROFILE, birthYear: null }).bmr).toBeNull();
    expect(deriveMetrics(measurement({ weightKg: 80 }), { ...PROFILE, heightCm: null }).bmr).toBeNull();
    expect(deriveMetrics(measurement({}), PROFILE).bmr).toBeNull();
  });
});

describe('età dall\'anno di nascita', () => {
  it('anno di riferimento − anno di nascita', () => {
    expect(ageFromBirthYear(1990, new Date(2026, 0, 1))).toBe(36);
    expect(ageFromBirthYear(1990, new Date(2026, 11, 31))).toBe(36);
    expect(ageFromBirthYear(1990, '2024-06-30')).toBe(34);
  });

  it('caso limite: senza anno o con anno dopo il riferimento → nessuna età', () => {
    expect(ageFromBirthYear(null, new Date(2026, 0, 1))).toBeNull();
    expect(ageFromBirthYear(2027, new Date(2026, 0, 1))).toBeNull();
    expect(ageFromBirthYear(2026, new Date(2026, 0, 1))).toBe(0);
  });
});

describe('ultimo peso', () => {
  it('salta le misure senza peso, qualsiasi ordine', () => {
    const list = [
      measurement({ date: '2026-08-14', weightKg: 80 }),
      measurement({ date: '2026-10-01', weightKg: null }),
      measurement({ date: '2026-09-25', weightKg: 79 }),
    ];
    expect(latestWeight(list)).toBe(79);
    expect(latestWeight([])).toBeNull();
  });
});
