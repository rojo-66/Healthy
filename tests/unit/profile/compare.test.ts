import { describe, expect, it } from 'vitest';
import type { Goal } from '../../../src/lib/data/schemas/profile';
import { compareMetrics } from '../../../src/lib/profile/compare';
import { checkMeasurement, sumTolerance } from '../../../src/lib/profile/consistency';
import { DIRECTION_RULES, deltaTone, directionFor } from '../../../src/lib/profile/direction';
import {
  deltaPctText,
  deltaSpoken,
  deltaText,
  longDate,
  metricText,
  metricWithUnit,
  numericDate,
  spanText,
} from '../../../src/lib/profile/format';
import { deriveMetrics, METRIC_KEYS, type MetricKey } from '../../../src/lib/profile/metrics';
import { measurement, PROFILE } from './helpers';

describe('coerenza', () => {
  const values = (v: Parameters<typeof measurement>[0]) => {
    const { id: _i, date: _d, notes: _n, ...rest } = measurement(v);
    return rest;
  };

  it('tolleranza FM + FFM: il più grande tra 1 kg e 1,5 % del peso', () => {
    expect(sumTolerance(50)).toBe(1);
    expect(sumTolerance(100)).toBe(1.5);
    // 80 kg → 1,2 kg di tolleranza
    expect(checkMeasurement(values({ weightKg: 80, fmKg: 16, ffmKg: 62.8 })).warnings).toEqual([]);
    expect(checkMeasurement(values({ weightKg: 80, fmKg: 16, ffmKg: 65.3 })).warnings).toEqual([
      'FM + FFM = 81,3 kg, ma il peso è 80,0 kg: controlla i valori.',
    ]);
  });

  it('FM % misurata e FM kg / peso: oltre 1 punto è un avviso', () => {
    expect(checkMeasurement(values({ weightKg: 80, fmKg: 16, fmPct: 20.9 })).warnings).toEqual([]);
    expect(checkMeasurement(values({ weightKg: 80, fmKg: 16, fmPct: 22 })).warnings).toEqual([
      'FM 22,0 % non torna con 16,0 kg su 80,0 kg (20,0 %): controlla i valori.',
    ]);
  });

  it('impossibilità: errori leggibili sul campo giusto', () => {
    const report = checkMeasurement(values({ weightKg: 60, fmKg: 70, ffmKg: 65, bcmKg: 66, tbwL: 61, ecwL: 62 }));
    expect(report.errors).toEqual([
      { field: 'fmKg', message: 'La massa grassa (70,0 kg) supera il peso (60,0 kg).' },
      { field: 'ffmKg', message: 'La massa magra (65,0 kg) supera il peso (60,0 kg).' },
      { field: 'bcmKg', message: 'La massa cellulare (66,0 kg) supera la massa magra (65,0 kg).' },
      { field: 'ecwL', message: "L'acqua extracellulare (62,0 L) supera l'acqua totale (61,0 L)." },
      { field: 'tbwL', message: "L'acqua totale (61,0 L) supera il peso (60,0 kg)." },
    ]);
    // Con valori impossibili niente avviso sulla somma (l'errore basta).
    expect(report.warnings).toEqual([]);
  });

  it('BCM confrontata con la FFM calcolata se manca quella misurata', () => {
    expect(checkMeasurement(values({ weightKg: 80, fmKg: 20, bcmKg: 61 })).errors).toEqual([
      { field: 'bcmKg', message: 'La massa cellulare (61,0 kg) supera la massa magra calcolata (peso − FM) (60,0 kg).' },
    ]);
  });

  it('valori parziali: nessun controllo su ciò che manca', () => {
    expect(checkMeasurement(values({ fmKg: 16 }))).toEqual({ errors: [], warnings: [] });
  });
});

describe('direzione giusta per obiettivo', () => {
  const goals: Goal[] = ['lose', 'recomp', 'gain', 'maintain'];

  it('ogni parametro ha una regola per ogni obiettivo', () => {
    for (const key of METRIC_KEYS) {
      expect(Object.keys(DIRECTION_RULES[key].byGoal).sort()).toEqual([...goals].sort());
      expect(DIRECTION_RULES[key].threshold).toBeGreaterThan(0);
    }
  });

  it('tabella confermata (estratto)', () => {
    const table = (key: MetricKey) => goals.map((g) => directionFor(key, g));
    expect(table('weight')).toEqual(['down', 'none', 'up', 'stable']);
    expect(table('fmKg')).toEqual(['down', 'down', 'none', 'stable']);
    expect(table('ffmKg')).toEqual(['up', 'up', 'up', 'up']);
    expect(table('ecwTbw')).toEqual(['down', 'down', 'down', 'down']);
    expect(table('tbw')).toEqual(['none', 'none', 'none', 'none']);
    expect(table('chest')).toEqual(['none', 'up', 'up', 'none']);
    expect(table('waist')).toEqual(['down', 'down', 'none', 'stable']);
    expect(table('calf')).toEqual(['none', 'up', 'up', 'none']);
  });

  it('senza obiettivo: colorate solo le righe uguali per tutti', () => {
    expect(directionFor('pha', null)).toBe('up');
    expect(directionFor('ecw', null)).toBe('down');
    expect(directionFor('weight', null)).toBe('none');
    expect(deltaTone('pha', null, 0.3)).toBe('good');
    expect(deltaTone('weight', null, -3)).toBe('neutral');
  });

  it('soglia neutra: sotto è grigia, uguale conta', () => {
    expect(deltaTone('weight', 'lose', -0.4)).toBe('neutral');
    expect(deltaTone('weight', 'lose', -0.5)).toBe('good');
    expect(deltaTone('weight', 'lose', 0.5)).toBe('warn');
    expect(deltaTone('arm', 'recomp', 0.3)).toBe('good');
    expect(deltaTone('calf', 'recomp', 0.2)).toBe('neutral');
  });

  it('mantenimento (=): giallo solo oltre la banda, nei due sensi', () => {
    expect(deltaTone('weight', 'maintain', 0.8)).toBe('neutral');
    expect(deltaTone('weight', 'maintain', 1)).toBe('warn');
    expect(deltaTone('weight', 'maintain', -1.2)).toBe('warn');
    expect(deltaTone('waist', 'maintain', -1.4)).toBe('neutral');
    expect(deltaTone('waist', 'maintain', 1.5)).toBe('warn');
  });

  it('i dati di esempio del mockup (Ricomposizione) danno i colori del mockup', () => {
    expect(deltaTone('weight', 'recomp', 1.1)).toBe('neutral');
    expect(deltaTone('bmr', 'recomp', 12)).toBe('good');
    expect(deltaTone('pha', 'recomp', -0.3)).toBe('warn');
    expect(deltaTone('fmKg', 'recomp', -1.1)).toBe('good');
    expect(deltaTone('ffmKg', 'recomp', 2.2)).toBe('good');
    expect(deltaTone('bcmKg', 'recomp', 0.4)).toBe('good');
    expect(deltaTone('tbw', 'recomp', 1.8)).toBe('neutral');
    expect(deltaTone('ecw', 'recomp', 1.4)).toBe('warn');
    expect(deltaTone('ecwTbw', 'recomp', 1.5)).toBe('warn');
    expect(deltaTone('chest', 'recomp', 1.5)).toBe('good');
    expect(deltaTone('waist', 'recomp', 0)).toBe('neutral');
    expect(deltaTone('abdomen', 'recomp', -0.8)).toBe('good');
    expect(deltaTone('hips', 'recomp', -1)).toBe('good');
    expect(deltaTone('thigh', 'recomp', 0.6)).toBe('good');
  });
});

describe('confronto tra due misure', () => {
  const before = deriveMetrics(
    measurement({ date: '2026-08-14', weightKg: 80.2, fmKg: 16.1, ffmKg: 64.1, bcmKg: 35.3, phaDeg: 6.4, calfCm: 38 }),
    PROFILE,
  );
  const now = deriveMetrics(
    measurement({ date: '2026-09-25', weightKg: 78.9, fmKg: 14.8, ffmKg: 64.1, bcmKg: 35.9, phaDeg: 6.3, waistCm: 86, bmrKcal: 1765 }),
    PROFILE,
  );
  const rows = compareMetrics(now, before, 'recomp');

  it('differenza assoluta (arrotondata come a video) e percentuale', () => {
    expect(rows.weight.delta).toBe(-1.3);
    expect(rows.weight.deltaPct).toBeCloseTo((-1.3 / 80.2) * 100, 6);
    expect(rows.fmKg).toMatchObject({ delta: -1.3, tone: 'good' });
    expect(rows.ffmKg).toMatchObject({ delta: 0, tone: 'neutral' });
    expect(rows.pha).toMatchObject({ delta: -0.1, tone: 'warn' });
  });

  it('i parametri mancanti in una delle due misure non hanno variazione (mai zero)', () => {
    expect(rows.waist).toMatchObject({ before: null, delta: null, deltaPct: null, tone: 'neutral' });
    expect(rows.waist.now?.value).toBe(86);
    expect(rows.calf).toMatchObject({ now: null, delta: null });
    expect(rows.tbw).toMatchObject({ now: null, before: null, delta: null });
  });

  it('BMR misurato non si confronta con quello stimato', () => {
    expect(before.bmr?.origin).toBe('estimated');
    expect(rows.bmr).toMatchObject({ delta: null, tone: 'neutral' });
    expect(rows.bmr.now).toEqual({ value: 1765, origin: 'measured' });
  });

  it('due BMR stimati: variazione grigia', () => {
    const a = deriveMetrics(measurement({ weightKg: 80 }), PROFILE);
    const b = deriveMetrics(measurement({ weightKg: 82 }), PROFILE);
    expect(compareMetrics(b, a, 'gain').bmr).toMatchObject({ delta: 20, tone: 'neutral' });
  });

  it('con una sola misura: valori senza confronto', () => {
    const single = compareMetrics(now, null, 'recomp');
    expect(single.weight).toMatchObject({ now: { value: 78.9 }, before: null, delta: null });
  });

  it('variazioni piccole non diventano "-0"', () => {
    const a = deriveMetrics(measurement({ weightKg: 80.04 }), PROFILE);
    const b = deriveMetrics(measurement({ weightKg: 79.96 }), PROFILE);
    expect(Object.is(compareMetrics(b, a, 'lose').weight.delta, 0)).toBe(true);
  });
});

describe('testi', () => {
  it('valori con la virgola, kcal con il punto delle migliaia, "—" se mancano', () => {
    expect(metricText('weight', 76.25)).toBe('76,3');
    expect(metricText('bmr', 1720)).toBe('1.720');
    expect(metricText('weight', null)).toBe('—');
    expect(metricWithUnit('weight', 76.2)).toBe('76,2 kg');
    expect(metricWithUnit('pha', 6.2)).toBe('6,2°');
    expect(metricWithUnit('ecwTbw', 42.1)).toBe('42,1 %');
  });

  it('variazioni con freccia, segno tipografico e punti per le percentuali', () => {
    expect(deltaText('weight', 1.1)).toBe('▲ +1,1 kg');
    expect(deltaText('pha', -0.3)).toBe('▼ −0,3°');
    expect(deltaText('ecwTbw', 1.5)).toBe('▲ +1,5 pt');
    expect(deltaText('waist', 0)).toBe('= 0,0 cm');
    expect(deltaText('abdomen', -0.8, false)).toBe('▼ −0,8');
    expect(deltaText('bmr', 12)).toBe('▲ +12 kcal');
    expect(deltaPctText(1.37)).toBe('+1,4 %');
    expect(deltaPctText(-7)).toBe('−7,0 %');
    expect(deltaSpoken('weight', -1.1)).toBe('calo di 1,1 kg');
    expect(deltaSpoken('ecwTbw', 1.5)).toBe('aumento di 1,5 punti');
    expect(deltaSpoken('weight', 0)).toBe('invariato');
  });

  it('date e distanza tra le misure', () => {
    expect(longDate('2026-09-25')).toBe('25 SET 2026');
    expect(numericDate('2026-08-14')).toBe('14/08/2026');
    expect(spanText('2026-08-14', '2026-09-25')).toBe('6 settimane');
    expect(spanText('2026-09-15', '2026-09-25')).toBe('10 giorni');
    expect(spanText('2026-09-24', '2026-09-25')).toBe('1 giorno');
    expect(spanText('2026-03-01', '2026-09-25')).toBe('7 mesi');
    // Cambio dell'ora legale nel mezzo: sempre giorni interi.
    expect(spanText('2026-10-20', '2026-10-30')).toBe('10 giorni');
  });
});
