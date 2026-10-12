import { describe, expect, it } from 'vitest';
import type { DietPlan } from '../../../src/lib/data/schemas/diet-plans';
import { buildDayView } from '../../../src/lib/diet/view';
import {
  adherenceSummary,
  dietDays,
  dietObservation,
  dietStart,
  heatLevel,
  heatmapWeeks,
  macroAverages,
  targetDeviation,
  type MacroSummary,
} from '../../../src/lib/progress/diet';
import { progressTables, TODAY } from './helpers';

const t = progressTables();
const ACTIVE = t.dietPlans.find((p) => p.active)!;
const OLD = t.dietPlans.find((p) => !p.active)!;
const days = dietDays(t.dietPlans, t.dietLog, TODAY);
const day = (date: string) => days.find((d) => d.date === date)!;

describe('tab Dieta: giorni del piano attivo', () => {
  it('parte dal primo giorno del piano attivo: il più tardo tra validità e importazione', () => {
    expect(dietStart(ACTIVE, t.dietLog)).toBe('2026-10-01');
    expect(dietStart({ ...ACTIVE, validFrom: '2026-09-20' }, t.dietLog)).toBe('2026-09-30');
    expect(dietStart({ ...ACTIVE, validFrom: null, importedAt: null }, t.dietLog)).toBe('2026-10-01');
    expect(dietStart({ ...ACTIVE, id: 'nuovo', validFrom: null, importedAt: null }, t.dietLog)).toBeNull();
    expect(days.map((d) => d.date)).toEqual(Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`));
  });

  it('oggi è "in corso"; nessun giorno futuro', () => {
    expect(days.at(-1)).toMatchObject({ date: TODAY, today: true, eaten: 1, planned: 5 });
    expect(days.filter((d) => d.today)).toHaveLength(1);
    expect(dietDays(t.dietPlans, t.dietLog, '2026-09-25')).toEqual([]);
  });

  it('pasti segnati / pasti previsti non vuoti; giorno senza diario = nessun pasto segnato', () => {
    expect(day('2026-10-03')).toMatchObject({ planned: 3, eaten: 2 });
    expect(day('2026-10-03').pct).toBeCloseTo(66.67, 1);
    expect(day('2026-10-04')).toMatchObject({ planned: 3, eaten: 0, pct: 0 });
    expect(day('2026-10-05')).toMatchObject({ planned: 5, eaten: 4, pct: 80 });
  });

  it('"seguo il piano di un altro giorno": si usano i pasti del giorno scelto', () => {
    // Mercoledì (4 pasti non vuoti) che segue il lunedì (5 pasti).
    expect(day('2026-10-07')).toMatchObject({ weekday: 1, planned: 5, eaten: 4, pct: 80 });
    expect(day('2026-10-07').missed.map((m) => m.key)).toEqual(['cena']);
  });

  it('ogni giorno usa il piano del suo diario (dietLog.planId)', () => {
    expect(day('2026-10-06')).toMatchObject({ planId: OLD.id, pct: 100 });
    expect(day('2026-10-06').targets?.kcal).toBe(2000);
    expect(day('2026-10-05')).toMatchObject({ planId: ACTIVE.id });
    expect(day('2026-10-05').targets?.kcal).toBe(1620);
  });

  it('totali uguali a quelli della Dieta (M3) per lo stesso giorno', () => {
    const log = t.dietLog.find((l) => l.date === '2026-10-05')!;
    const view = buildDayView(ACTIVE.payload, 1, { today: false, keepEaten: true, eaten: log.eaten, nowMinutes: 0 })!;
    expect(day('2026-10-05').eatenTotals).toEqual(view.eatenTotals.total);
  });

  it('senza piano attivo nessun giorno', () => {
    expect(dietDays([OLD], t.dietLog, TODAY)).toEqual([]);
    expect(dietDays([], [], TODAY)).toEqual([]);
  });
});

describe('aderenza', () => {
  it('media dei giorni conclusi (oggi escluso), giorni al 100 %, pasto più saltato', () => {
    const summary = adherenceSummary(days);
    expect(summary.days).toBe(11);
    expect(summary.perfect).toBe(6);
    expect(summary.average).toBe(82);
    // pranzo, cena e spuntino 2 saltati 2 volte: vince il primo nell'ordine dei pasti.
    expect(summary.mostSkipped).toEqual({ key: 'pranzo', label: 'Pranzo', times: 2 });
  });

  it('senza giorni conclusi niente media', () => {
    expect(adherenceSummary(days.filter((d) => d.today))).toEqual({ average: null, days: 0, perfect: 0, mostSkipped: null });
  });

  it('calendario: righe da lunedì a domenica, oggi segnato, celle senza dati', () => {
    const weeks = heatmapWeeks(days, TODAY);
    expect(weeks.map((w) => w.monday)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(weeks[0]!.cells.slice(0, 3).map((c) => c.level)).toEqual(['none', 'none', 'none']);
    expect(weeks[0]!.cells[5]).toMatchObject({ date: '2026-10-03', pct: 67, level: '60' });
    expect(weeks[0]!.cells[6]).toMatchObject({ date: '2026-10-04', pct: 0, level: 'low' });
    expect(weeks[2]!.cells[0]).toMatchObject({ date: TODAY, today: true, pct: 20 });
    expect(weeks[2]!.cells[1]).toMatchObject({ level: 'none', pct: null });
    expect([heatLevel(59.9), heatLevel(60), heatLevel(80), heatLevel(99.9), heatLevel(100), heatLevel(null)]).toEqual([
      'low',
      '60',
      '80',
      '80',
      '100',
      'none',
    ]);
  });
});

describe('scarto dal target e macro medi', () => {
  it('(kcal mangiate − target) / target; giorni senza pasti segnati esclusi e contati', () => {
    const { days: list, excluded } = targetDeviation(days);
    expect(excluded).toEqual({ noMeals: 1, incomplete: 0, noTarget: 0 });
    expect(list.map((d) => d.date)).not.toContain('2026-10-04');
    expect(list.map((d) => d.date)).not.toContain(TODAY);
    const d5 = list.find((d) => d.date === '2026-10-05')!;
    expect(d5.target).toBe(1620);
    expect(d5.pct).toBeCloseTo(((d5.kcal - 1620) / 1620) * 100, 6);
    for (const d of list) expect(d.out).toBe(Math.abs(d.pct) >= 5);
  });

  it('fascia ±5 %: esattamente 5 è già fuori (stessa soglia delle osservazioni M3)', () => {
    const base = day('2026-10-01');
    const at = (kcal: number) =>
      targetDeviation([{ ...base, eatenTotals: { ...base.eatenTotals, kcal }, targets: { ...base.targets!, kcal: 2000 } }]).days[0]!;
    expect(at(2100).out).toBe(true);
    expect(at(2099).out).toBe(false);
    expect(at(1900).out).toBe(true);
    expect(at(1901).out).toBe(false);
  });

  it('giorni senza target o con alimenti senza valori esclusi', () => {
    const base = day('2026-10-01');
    const summary = targetDeviation([
      { ...base, date: 'a', targets: null },
      { ...base, date: 'b', eatenComplete: false },
    ]);
    expect(summary).toEqual({ days: [], excluded: { noMeals: 0, incomplete: 1, noTarget: 1 } });
  });

  it('macro medi sui giorni confrontabili rispetto alla media dei target', () => {
    const m = macroAverages(days);
    expect(m.days).toBe(10);
    const ok = days.filter((d) => !d.today && d.eaten > 0);
    const protein = ok.reduce((s, d) => s + d.eatenTotals.protein, 0) / ok.length;
    expect(m.rows.find((r) => r.field === 'protein')?.eaten).toBeCloseTo(protein, 6);
    for (const r of m.rows) {
      expect(r.target).not.toBeNull();
      expect(r.out).toBe(Math.abs(r.pct!) >= 5);
    }
    expect(macroAverages([]).rows.every((r) => r.target === null && r.pct === null)).toBe(true);
  });
});

describe("osservazione dell'app (modulo M3, soglia 5 %)", () => {
  const summary = (protein: number): MacroSummary => ({
    days: 10,
    kcal: { eaten: 1900, target: 1900 },
    rows: [
      { field: 'protein', name: 'Proteine', eaten: protein, target: 166, pct: null, out: false },
      { field: 'carbs', name: 'Carboidrati', eaten: 262, target: 267, pct: null, out: false },
      { field: 'fat', name: 'Grassi', eaten: 47, target: 46, pct: null, out: false },
    ],
  });

  it('segnala lo scarto maggiore, solo come segnalazione', () => {
    const obs = dietObservation(summary(157));
    expect(obs.kind).toBe('deviation');
    expect(obs.text).toBe(
      'Le proteine sono in media del 5% sotto il target (157 g su 166 g, −5%), calcolate sui pasti che hai segnato. Se ti sembra strano, chiedi conferma al nutrizionista.',
    );
    expect(obs.disclaimer).toBe("L'app non modifica il piano: segnala soltanto.");
  });

  it('in linea sotto il 5 %; senza giorni un invito', () => {
    expect(dietObservation(summary(165)).kind).toBe('aligned');
    expect(dietObservation({ days: 0, kcal: null, rows: [] }).kind).toBe('none');
  });

  it('i maschili concordano', () => {
    const s = summary(165);
    s.rows[1] = { ...s.rows[1]!, eaten: 300 };
    expect(dietObservation(s).text).toMatch(/^I carboidrati sono in media del 12% sopra il target \(300 g su 267 g, \+12%\), calcolati/);
  });
});

describe('piano senza target', () => {
  it('i giorni contano nell\'aderenza ma non nello scarto', () => {
    const noTargets: DietPlan = {
      ...ACTIVE,
      payload: {
        ...ACTIVE.payload,
        dayTypes: Object.fromEntries(Object.entries(ACTIVE.payload.dayTypes).map(([k, v]) => [k, { ...v, targets: null }])),
        products: Object.fromEntries(Object.entries(ACTIVE.payload.products).map(([k, v]) => [k, { ...v, per100: null }])),
      },
    };
    const list = dietDays([noTargets], t.dietLog.filter((l) => l.planId === ACTIVE.id), TODAY);
    expect(adherenceSummary(list).days).toBe(11);
    const dev = targetDeviation(list);
    expect(dev.days).toEqual([]);
    expect(dev.excluded.incomplete + dev.excluded.noTarget + dev.excluded.noMeals).toBe(11);
  });
});

describe('fixture: giorni dentro e fuori dalla fascia', () => {
  it('i giorni completi stanno entro ±5 %, quelli con pasti saltati no', () => {
    const list = targetDeviation(days).days;
    expect(list.find((d) => d.date === '2026-10-02')?.out).toBe(false);
    expect(list.find((d) => d.date === '2026-10-05')?.out).toBe(true);
    expect(list.some((d) => !d.out) && list.some((d) => d.out)).toBe(true);
  });
});
