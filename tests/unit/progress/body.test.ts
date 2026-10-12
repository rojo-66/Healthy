import { describe, expect, it } from 'vitest';
import { bodyChange, bodySeries, nextMeasurementDate } from '../../../src/lib/progress/body';
import { measurement, PROFILE } from '../profile/helpers';

const MEASUREMENTS = [
  measurement({ id: 'b', date: '2026-08-14', weightKg: 80, fmKg: 20, phaDeg: 6.7 }),
  measurement({ id: 'c', date: '2026-09-25', waistCm: 87 }),
  measurement({ id: 'a', date: '2026-07-03', weightKg: 82, ffmKg: 60, phaDeg: 7.1, tbwL: 45, ecwL: 19 }),
];

describe('tab Corpo: serie dalle misure del Profilo', () => {
  const series = bodySeries(MEASUREMENTS, PROFILE);

  it('il peso salta le misure senza peso (mai zero) ed è in ordine di data', () => {
    expect(series.weight.map((p) => [p.date, p.value])).toEqual([
      ['2026-07-03', 82],
      ['2026-08-14', 80],
    ]);
  });

  it('FFM e FM: misurate o calcolate con la logica del Profilo (M7)', () => {
    expect(series.ffmKg).toEqual([
      { date: '2026-07-03', value: 60, origin: 'measured' },
      { date: '2026-08-14', value: 60, origin: 'calculated' },
    ]);
    expect(series.fmKg).toEqual([
      { date: '2026-07-03', value: 22, origin: 'calculated' },
      { date: '2026-08-14', value: 20, origin: 'measured' },
    ]);
    expect(series.ecwTbw).toEqual([{ date: '2026-07-03', value: (19 / 45) * 100, origin: 'calculated' }]);
    expect(series.bcmKg).toEqual([]);
    expect(series.waist).toEqual([{ date: '2026-09-25', value: 87, origin: 'measured' }]);
  });

  it('variazione colorata con la tabella delle direzioni per obiettivo (M7)', () => {
    expect(bodyChange('weight', series.weight, 'lose')).toEqual({ now: 80, delta: -2, tone: 'good' });
    expect(bodyChange('weight', series.weight, 'gain').tone).toBe('warn');
    expect(bodyChange('weight', series.weight, null).tone).toBe('neutral');
    expect(bodyChange('pha', series.pha, null)).toEqual({ now: 6.7, delta: -0.4, tone: 'warn' });
    expect(bodyChange('fmKg', [{ date: 'a', value: 20.1 }, { date: 'b', value: 20.3 }], 'lose')).toMatchObject({
      delta: 0.2,
      tone: 'neutral',
    });
  });

  it('un punto solo: valore senza variazione; nessun punto: niente', () => {
    expect(bodyChange('waist', series.waist, 'lose')).toEqual({ now: 87, delta: null, tone: 'neutral' });
    expect(bodyChange('bcmKg', [], 'lose')).toEqual({ now: null, delta: null, tone: 'neutral' });
  });

  it('due punti uguali: variazione 0, mai −0', () => {
    const change = bodyChange('weight', [{ date: 'a', value: 80.04 }, { date: 'b', value: 79.96 }], 'lose');
    expect(Object.is(change.delta, 0)).toBe(true);
    expect(change.tone).toBe('neutral');
  });
});

describe('prossima misura (settings.nextMeasurement del Profilo)', () => {
  it('vale solo se è dopo l\'ultima misura e non è passata', () => {
    expect(nextMeasurementDate({ date: '2026-11-06' }, '2026-10-02', '2026-10-12')).toBe('2026-11-06');
    expect(nextMeasurementDate({ date: '2026-10-12' }, '2026-10-02', '2026-10-12')).toBe('2026-10-12');
    expect(nextMeasurementDate({ date: '2026-10-01' }, '2026-09-02', '2026-10-12')).toBeNull();
    expect(nextMeasurementDate({ date: '2026-11-06' }, '2026-11-06', '2026-10-12')).toBeNull();
    expect(nextMeasurementDate({ date: null }, '2026-10-02', '2026-10-12')).toBeNull();
    expect(nextMeasurementDate(undefined, null, '2026-10-12')).toBeNull();
  });
});
