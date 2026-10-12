import { describe, expect, it } from 'vitest';
import { divergingScale, niceScale, scaleY } from '../../../src/lib/progress/scale';
import { arrow, chartSummary, shortDay, signedPct, tonnes } from '../../../src/lib/progress/format';
import { extremes, markerIndexes, MANY_POINTS, pointsIn, seriesDelta, timeFractions } from '../../../src/lib/progress/series';
import { formatDecimal } from '../../../src/lib/diet/format';

describe('scala "bella" (SPEC § 5.7)', () => {
  it('peso del mockup: passo 0,5 con margine attorno ai dati', () => {
    expect(niceScale([87.5, 87.9, 88.9])).toEqual({ lo: 87, hi: 89.5, step: 0.5, ticks: [87, 87.5, 88, 88.5, 89, 89.5] });
  });

  it('range piccoli (angolo di fase) e grandi (volume)', () => {
    expect(niceScale([6.7, 7.1]).ticks).toEqual([6.6, 6.8, 7, 7.2]);
    expect(niceScale([9600, 16000]).ticks).toEqual([8000, 10000, 12000, 14000, 16000, 18000]);
    expect(niceScale([0.012, 0.013]).ticks.length).toBeGreaterThanOrEqual(3);
  });

  it('valori tutti uguali o un punto solo: scala non nulla attorno al valore', () => {
    const same = niceScale([70, 70, 70]);
    expect(same.hi - same.lo).toBeGreaterThan(0);
    expect(same.lo).toBeLessThan(70);
    expect(same.hi).toBeGreaterThan(70);
    const one = niceScale([0]);
    expect(one.ticks).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(niceScale([]).hi).toBeGreaterThan(niceScale([]).lo);
  });

  it('niente NaN né infinito anche con valori strani', () => {
    const s = niceScale([Number.NaN, Number.POSITIVE_INFINITY, 5]);
    for (const v of [s.lo, s.hi, s.step, ...s.ticks]) expect(Number.isFinite(v)).toBe(true);
    expect(s.lo).toBeLessThan(5);
    expect(s.hi).toBeGreaterThan(5);
  });

  it('le barre partono da zero, i conteggi hanno passi interi', () => {
    expect(niceScale([2, 3, 3, 1], { zero: true, integer: true }).ticks).toEqual([0, 1, 2, 3, 4]);
    expect(niceScale([0, 0], { zero: true, integer: true }).lo).toBe(0);
    expect(niceScale([0, 0], { zero: true, integer: true }).hi).toBeGreaterThan(0);
    expect(niceScale([5.4, 16], { zero: true }).lo).toBe(0);
  });

  it('su tanti intervalli casuali: 3–6 tacche, dati sempre dentro, tacche "rotonde"', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 500; i++) {
      const base = (rand() - 0.3) * 10 ** Math.floor(rand() * 6);
      const values = Array.from({ length: 1 + Math.floor(rand() * 8) }, () => base + rand() * Math.abs(base || 1) * rand());
      const s = niceScale(values);
      expect(s.ticks.length).toBeGreaterThanOrEqual(3);
      expect(s.ticks.length).toBeLessThanOrEqual(6);
      expect(s.lo).toBeLessThanOrEqual(Math.min(...values));
      expect(s.hi).toBeGreaterThanOrEqual(Math.max(...values));
      for (const t of s.ticks) expect(Math.abs(t / s.step - Math.round(t / s.step))).toBeLessThan(1e-6);
    }
  });

  it('barre divergenti: simmetriche, almeno ±10, a passi di 5', () => {
    expect(divergingScale([-2, 3, -8, 1])).toMatchObject({ lo: -10, hi: 10, ticks: [10, 0, -10] });
    expect(divergingScale([-2, 23])).toMatchObject({ lo: -30, hi: 30 });
    expect(divergingScale([])).toMatchObject({ lo: -10, hi: 10 });
  });

  it('posizione verticale: in alto il massimo, in basso il minimo', () => {
    expect(scaleY({ lo: 0, hi: 4 }, 4, 10, 100)).toBe(10);
    expect(scaleY({ lo: 0, hi: 4 }, 0, 10, 100)).toBe(110);
    expect(Number.isFinite(scaleY({ lo: 3, hi: 3 }, 3, 0, 100))).toBe(true);
  });
});

describe('serie nel tempo', () => {
  const pts = [
    { date: '2026-08-21', value: 87.5 },
    { date: '2026-08-28', value: 87.9 },
    { date: '2026-10-02', value: 88.9 },
  ];

  it('variazione tra primo e ultimo punto; con meno di 2 punti niente variazione', () => {
    expect(seriesDelta(pts)).toBeCloseTo(1.4);
    expect(seriesDelta(pts.slice(0, 1))).toBeNull();
    expect(seriesDelta([])).toBeNull();
  });

  it('filtro per periodo', () => {
    expect(pointsIn(pts, { from: '2026-08-25', to: '2026-10-12' }).map((p) => p.date)).toEqual(['2026-08-28', '2026-10-02']);
    expect(pointsIn(pts, null)).toEqual([]);
    expect(pointsIn(pts, undefined)).toHaveLength(3);
  });

  it('asse proporzionale al tempo, anche oltre l\'ultima data (prossima misura)', () => {
    expect(timeFractions(['2026-08-21', '2026-08-28', '2026-10-02'])).toEqual([0, 7 / 42, 1]);
    expect(timeFractions(['2026-08-21', '2026-10-02'], '2026-11-13')).toEqual([0, 0.5]);
    expect(timeFractions(['2026-08-21'])).toEqual([0.5]);
    expect(timeFractions(['2026-08-21', '2026-08-21'])).toEqual([0.5, 0.5]);
    expect(timeFractions([])).toEqual([]);
  });

  it(`serie lunghe (oltre ${MANY_POINTS} punti): pallini solo su selezionato, minimo e massimo`, () => {
    const long = Array.from({ length: 200 }, (_, i) => ({ date: `2026-01-01`, value: Math.sin(i / 10) * 5 + 80 }));
    const ext = extremes(long)!;
    expect(markerIndexes(long, 199)).toEqual(new Set([199, ext.min, ext.max]));
    expect(markerIndexes(pts, 0).size).toBe(3);
    expect(extremes([])).toBeNull();
  });
});

describe('testi all\'italiana', () => {
  it('numeri, percentuali, date', () => {
    expect(tonnes(5400)).toBe('5,4 t');
    expect(tonnes(16049)).toBe('16,0 t');
    expect(signedPct(-8.4)).toBe('−8 %');
    expect(signedPct(2.6)).toBe('+3 %');
    expect(signedPct(0.2)).toBe('0 %');
    expect(shortDay('2026-10-12')).toBe('12 ott');
    expect([arrow(1), arrow(-1), arrow(0)]).toEqual(['▲', '▼', '■']);
  });

  it('riassunto del grafico per lo screen reader', () => {
    const value = (v: number) => formatDecimal(v, 1);
    expect(
      chartSummary('Peso', [{ date: '2026-08-21', value: 87.5 }, { date: '2026-10-02', value: 88.9 }], value, 'kg'),
    ).toBe('Peso: da 87,5 a 88,9 kg dal 21/08 al 02/10');
    expect(chartSummary('Peso', [{ date: '2026-10-02', value: 88.9 }], value, 'kg')).toBe('Peso: 88,9 kg il 02/10, un solo valore');
    expect(chartSummary('Peso', [], value, 'kg')).toBe('Peso: nessun dato');
  });
});

describe('etichette dei giorni', () => {
  it('giorno della settimana e mese in italiano', async () => {
    const { weekdayDay, longDay } = await import('../../../src/lib/progress/format');
    expect(weekdayDay('2026-10-01')).toBe('gio 1 ott');
    expect(weekdayDay('2026-10-12')).toBe('lun 12 ott');
    expect(longDay('2026-10-01')).toBe('1 ottobre');
    expect(longDay('2026-08-21')).toBe('21 agosto');
  });
});
