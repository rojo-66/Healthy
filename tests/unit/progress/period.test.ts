import { afterAll, describe, expect, it } from 'vitest';

// Cambio dell'ora legale: i conti devono essere fatti sulle date, non sui millisecondi.
// Il fuso si imposta prima di creare qualsiasi data in questo file e si rimette a posto alla fine.
const previousTz = process.env.TZ;
process.env.TZ = 'Europe/Rome';
afterAll(() => {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

import { addDays } from '../../../src/lib/diet/calc/calendar';
import { addMonthsIso, dataSpan, inRange, mondayOf, periodRange, weeksBetween } from '../../../src/lib/progress/period';
import { spanLine } from '../../../src/lib/progress/format';
import { dietDays } from '../../../src/lib/progress/diet';
import { progressTables } from './helpers';

describe('periodi di Progressi (SPEC § 5.7)', () => {
  it('il fuso del test è davvero quello italiano (ora legale fino al 25/10/2026)', () => {
    expect(new Date(2026, 9, 24, 12).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 9, 26, 12).getTimezoneOffset()).toBe(-60);
  });

  it('"4 sett" = 4 settimane da lunedì a domenica, compresa quella in corso', () => {
    expect(periodRange('4w', '2026-10-12', '2026-01-01')).toEqual({ from: '2026-09-21', to: '2026-10-12' });
    // Domenica: la settimana in corso è ancora quella del lunedì 5/10.
    expect(periodRange('4w', '2026-10-11', '2026-01-01')).toEqual({ from: '2026-09-14', to: '2026-10-11' });
  });

  it('"3 mesi" parte dal lunedì della settimana di "oggi − 3 mesi"', () => {
    expect(periodRange('3m', '2026-10-12', '2026-01-01')).toEqual({ from: '2026-07-06', to: '2026-10-12' });
  });

  it('"Tutto" parte dal lunedì della settimana del primo dato', () => {
    expect(periodRange('all', '2026-10-12', '2026-07-01')).toEqual({ from: '2026-06-29', to: '2026-10-12' });
  });

  it("l'inizio non va mai prima della settimana del primo dato; senza dati nessun intervallo", () => {
    expect(periodRange('4w', '2026-10-12', '2026-10-01')).toEqual({ from: '2026-09-28', to: '2026-10-12' });
    expect(periodRange('3m', '2026-10-12', '2026-10-12')).toEqual({ from: '2026-10-12', to: '2026-10-12' });
    expect(periodRange('all', '2026-10-12', null)).toBeNull();
  });

  it('mesi di calendario: fine mese e anni bisestili', () => {
    expect(addMonthsIso('2026-12-31', -3)).toBe('2026-09-30');
    expect(addMonthsIso('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsIso('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonthsIso('2026-01-15', -3)).toBe('2025-10-15');
    expect(addMonthsIso('2025-11-30', 3)).toBe('2026-02-28');
  });

  it('confine di anno: la settimana dal 29/12/2025 al 04/01/2026 è una sola', () => {
    expect(mondayOf('2026-01-04')).toBe('2025-12-29');
    expect(weeksBetween('2025-12-29', '2026-01-04')).toEqual(['2025-12-29']);
    expect(weeksBetween('2025-12-24', '2026-01-05')).toEqual(['2025-12-22', '2025-12-29', '2026-01-05']);
    expect(periodRange('4w', '2026-01-02', '2025-01-01')).toEqual({ from: '2025-12-08', to: '2026-01-02' });
  });

  it("cambio dell'ora (25/10/2026 e 29/03/2026): giorni e settimane non si spostano", () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-26', -1)).toBe('2026-10-25');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(weeksBetween('2026-10-19', '2026-11-02')).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(weeksBetween('2026-03-23', '2026-04-05')).toEqual(['2026-03-23', '2026-03-30']);
    expect(periodRange('4w', '2026-10-27', '2026-01-01')).toEqual({ from: '2026-10-05', to: '2026-10-27' });
    expect(dataSpan(['2026-10-19'], '2026-11-02')).toEqual({ first: '2026-10-19', weeks: 2 });
  });

  it("diario della dieta attraverso il cambio d'ora: ogni giorno una volta sola, in ordine", () => {
    const plan = { ...progressTables().dietPlans.find((p) => p.active)!, validFrom: '2026-10-20', importedAt: '2026-10-19T08:00:00.000Z' };
    const days = dietDays([plan], [], '2026-10-28');
    expect(days.map((d) => d.date)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
    expect(days.find((d) => d.date === '2026-10-25')?.weekday).toBe(7);
    expect(days.find((d) => d.date === '2026-10-26')?.weekday).toBe(1);
  });

  it('dentro o fuori dal periodo (estremi compresi)', () => {
    const range = { from: '2026-09-21', to: '2026-10-12' };
    expect(inRange('2026-09-21', range)).toBe(true);
    expect(inRange('2026-10-12', range)).toBe(true);
    expect(inRange('2026-09-20', range)).toBe(false);
    expect(inRange('2026-10-13', range)).toBe(false);
    expect(inRange('2026-10-01', null)).toBe(false);
  });

  it('riga "DAL … · N SETTIMANE DI DATI"', () => {
    const span = dataSpan(['2026-09-01', '2026-08-21', '2026-10-02'], '2026-10-12');
    expect(span).toEqual({ first: '2026-08-21', weeks: 7 });
    expect(spanLine(span)).toBe('DAL 21 AGO 2026 · 7 SETTIMANE DI DATI');
    expect(spanLine(dataSpan(['2026-10-12'], '2026-10-12'))).toBe('DAL 12 OTT 2026 · 1 SETTIMANA DI DATI');
    expect(spanLine(dataSpan([], '2026-10-12'))).toBe('NESSUN DATO ANCORA');
  });
});
