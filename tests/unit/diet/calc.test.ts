import { describe, expect, it } from 'vitest';
import type { Profile } from '../../../src/lib/data/schemas/profile';
import { activityFactor, estimateInputFrom, estimateKcal, mifflinStJeor } from '../../../src/lib/diet/calc/estimate';
import {
  dayTotals,
  emptyTotals,
  hasCompleteValues,
  itemGrams,
  itemNutrients,
  mealTotals,
  sumTotals,
  type Totals,
} from '../../../src/lib/diet/calc/nutrients';
import { DEVIATION_THRESHOLD_PCT, dayObservations, deviations } from '../../../src/lib/diet/calc/observations';
import { resolveTargets, TARGET_ORIGIN_LABELS, type ResolvedTargets } from '../../../src/lib/diet/calc/targets';
import { dayHasVegetables, isVegetable } from '../../../src/lib/diet/calc/vegetables';
import { payload, PRODUCTS } from './helpers';

const plan = (days: unknown[], extra: Record<string, unknown> = {}) => payload({ products: PRODUCTS, days, ...extra });
const meal = (key: string, items: [string, number][]) => ({ key, label: key, name: key, items: items.map(([p, q]) => ({ p, q })) });

describe('macro e kcal', () => {
  const p = plan([{ weekday: 1, meals: [] }]).products;

  it('alimento in grammi, millilitri e pezzi', () => {
    expect(itemGrams(p.pollo!, 150)).toBe(150);
    expect(itemGrams(p.latte!, 250)).toBe(250);
    expect(itemGrams(p.uova!, 2)).toBe(100);
    expect(itemGrams(p.pizza!, 1)).toBeNull();

    const pollo = itemNutrients(p.pollo!, 150);
    expect(pollo).toEqual({ ok: true, value: { kcal: 150, protein: 30, carbs: 0, fat: 3, fiber: 0 }, fiberKnown: true });
    const uova = itemNutrients(p.uova!, 2);
    expect(uova).toMatchObject({ ok: true, value: { kcal: 140, protein: 12 }, fiberKnown: false });
    expect(itemNutrients(p.latte!, 250)).toMatchObject({ ok: true, value: { kcal: 125 } });
  });

  it('senza valori o senza grammi per pezzo: segnalato, non zero', () => {
    expect(itemNutrients(p.ignoto!, 100)).toEqual({ ok: false, reason: 'no-values' });
    expect(itemNutrients(p.pizza!, 1)).toEqual({ ok: false, reason: 'no-piece-grams' });
    expect(hasCompleteValues(p.ignoto!)).toBe(false);
    expect(hasCompleteValues(p.pizza!)).toBe(false);
    expect(hasCompleteValues(p.uova!)).toBe(true);
  });

  it('pasto: somma di ciò che ha valori + elenco di ciò che manca', () => {
    const t = mealTotals(meal('pranzo', [['pollo', 150], ['riso', 80], ['ignoto', 30], ['ignoto', 10]]) as never, p);
    expect(t.total.kcal).toBeCloseTo(430);
    expect(t.total.protein).toBeCloseTo(35.6);
    expect(t.total.carbs).toBeCloseTo(64);
    expect(t.total.fat).toBeCloseTo(3.8);
    expect(t.total.fiber).toBeCloseTo(0.8);
    expect(t).toMatchObject({ missing: ['ignoto'], itemCount: 4, complete: false });
  });

  it('giorno: tutti i pasti o solo alcuni (es. quelli mangiati); fibre mancanti segnalate', () => {
    const day = plan([
      { weekday: 1, meals: [meal('colazione', [['uova', 2]]), meal('pranzo', [['pollo', 100]]), meal('cena', [['pizza', 1]])] },
    ]).days[0]!;
    const all = dayTotals(day, p);
    expect(all.total.kcal).toBeCloseTo(240);
    expect(all).toMatchObject({ missing: ['pizza'], fiberMissing: ['uova'], complete: false, itemCount: 3 });
    const eaten = dayTotals(day, p, (m) => m.key === 'pranzo');
    expect(eaten.total.kcal).toBeCloseTo(100);
    expect(eaten.complete).toBe(true);
    expect(sumTotals([]).complete).toBe(true);
  });
});

describe('target: priorità e origine', () => {
  const days = (type: string | null) => [{ weekday: 1, type, meals: [meal('pranzo', [['pollo', 200], ['riso', 100]])] }];

  it('1. target del tipo di giornata, così come sono, con la loro origine', () => {
    const targets = { kcal: 1800, protein: 140 };
    for (const [source, origin] of [
      ['plan', 'nutritionist'],
      ['manual', 'manual'],
      ['estimated', 'estimated'],
    ] as const) {
      const p = plan(days('gym'), { dayTypes: { gym: { label: 'Palestra', targets, targetsSource: source } } });
      expect(resolveTargets(p, p.days[0]!)).toEqual({
        targets: { kcal: 1800, protein: 140, carbs: null, fat: null, fiber: null },
        origin,
      });
    }
    // Il default (piani salvati prima di M3) è "dal nutrizionista".
    const old = plan(days('gym'), { dayTypes: { gym: { label: 'Palestra', targets } } });
    expect(resolveTargets(old, old.days[0]!)?.origin).toBe('nutritionist');
  });

  it('2. calcolati dal piano se mancano i target (solo con tutti i valori)', () => {
    const p = plan(days(null));
    expect(resolveTargets(p, p.days[0]!)).toEqual({
      targets: { kcal: 550, protein: 47, carbs: 80, fat: 5, fiber: 1 },
      origin: 'calculated',
    });
    const typeWithoutTargets = plan(days('gym'), { dayTypes: { gym: { label: 'Palestra' } } });
    expect(resolveTargets(typeWithoutTargets, typeWithoutTargets.days[0]!)?.origin).toBe('calculated');

    const incomplete = plan([{ weekday: 1, meals: [meal('pranzo', [['pollo', 200], ['ignoto', 10]])] }]);
    expect(resolveTargets(incomplete, incomplete.days[0]!)).toBeNull();
    const empty = plan([{ weekday: 1, meals: [] }]);
    expect(resolveTargets(empty, empty.days[0]!)).toBeNull();
  });

  it('etichette di origine', () => {
    expect(TARGET_ORIGIN_LABELS).toEqual({
      nutritionist: 'TARGET: NUTRIZIONISTA',
      manual: 'TARGET: INSERITO DA TE',
      estimated: 'TARGET: STIMATO',
      calculated: 'TARGET: CALCOLATO',
    });
  });
});

describe('stima Mifflin-St Jeor', () => {
  const man = { sex: 'M', age: 30, heightCm: 180, weightKg: 80, goal: 'maintain' } as const;

  it('formula e fattori di attività', () => {
    expect(mifflinStJeor(man)).toBe(1780);
    expect(mifflinStJeor({ sex: 'F', age: 30, heightCm: 160, weightKg: 50 })).toBe(1189);
    expect(estimateKcal(man, 'gym')).toEqual({ kcal: 2760, bmr: 1780, factor: 1.55, warnings: [] });
    expect(estimateKcal(man, 'run')?.kcal).toBe(2580);
    expect(estimateKcal(man, 'rest')?.kcal).toBe(2140);
    expect(estimateKcal(man, 'altro')).toBeNull();
  });

  it('obiettivo: dimagrire −15% (massimo −500), aumentare +10%', () => {
    expect(estimateKcal({ ...man, goal: 'lose' }, 'gym')?.kcal).toBe(2350);
    // BMR 2180 × 1,55 = 3379: il 15% (507) supera il massimo, si tolgono 500.
    expect(estimateKcal({ ...man, weightKg: 120, goal: 'lose' }, 'gym')?.kcal).toBe(2880);
    expect(estimateKcal({ ...man, goal: 'gain' }, 'gym')?.kcal).toBe(3030);
  });

  it('minimo di sicurezza con avviso', () => {
    const small = { sex: 'F', age: 60, heightCm: 150, weightKg: 45, goal: 'lose' } as const;
    const estimate = estimateKcal(small, 'rest')!;
    expect(estimate.kcal).toBe(1200);
    expect(estimate.warnings).toEqual([
      'La stima scende sotto il minimo di sicurezza: uso 1.200 kcal. Un obiettivo così va concordato con il nutrizionista.',
    ]);
    expect(estimateKcal({ ...small, sex: 'M' }, 'rest')?.kcal).toBe(1500);
  });

  it('senza età, altezza, peso o sesso non si stima', () => {
    const today = new Date(2026, 9, 12);
    const profile: Profile = { id: 'me', name: '', birthYear: 1990, sex: 'M', heightCm: 178, goal: null, activityLevel: 'active' };
    expect(estimateInputFrom(profile, 80, today)).toEqual({
      ok: true,
      value: { sex: 'M', age: 36, heightCm: 178, weightKg: 80, goal: null, activityLevel: 'active' },
    });
    expect(estimateInputFrom(undefined, null, today)).toEqual({ ok: false, missing: ['età', 'altezza', 'peso', 'sesso'] });
    expect(estimateInputFrom({ ...profile, heightCm: null }, 80, today)).toEqual({ ok: false, missing: ['altezza'] });
    // Anno di nascita dopo oggi: l'età non si sa.
    expect(estimateInputFrom({ ...profile, birthYear: 2030 }, 80, today)).toEqual({ ok: false, missing: ['età'] });
  });

  it('livello di attività: sedentario = fattori M3, attivo +0,15 su ogni tipo di giornata', () => {
    expect(activityFactor('rest')).toBe(1.2);
    expect(activityFactor('run', 'sedentary')).toBe(1.45);
    expect(activityFactor('gym', 'sedentary')).toBe(1.55);
    expect(activityFactor('rest', 'active')).toBe(1.35);
    expect(activityFactor('run', 'active')).toBe(1.6);
    expect(activityFactor('gym', 'active')).toBe(1.7);
    expect(activityFactor('altro', 'active')).toBeNull();
    // 1780 × 1,7 = 3026 → 3030
    expect(estimateKcal({ ...man, activityLevel: 'active' }, 'gym')).toEqual({ kcal: 3030, bmr: 1780, factor: 1.7, warnings: [] });
  });

  it('avvisi: formula per adulti e dati fuori dai valori abituali', () => {
    expect(estimateKcal({ ...man, age: 16 }, 'gym')?.warnings).toEqual([
      'La formula è pensata per gli adulti: sotto i 18 anni la stima è poco affidabile.',
    ]);
    expect(estimateKcal({ ...man, heightCm: 230 }, 'gym')?.warnings).toEqual([
      'Età, altezza o peso sono fuori dai valori abituali: controlla il Profilo, la stima è poco affidabile.',
    ]);
  });
});

describe('osservazioni', () => {
  const totals = (kcal: number, protein = 0, complete = true): Totals => ({
    ...emptyTotals(),
    total: { kcal, protein, carbs: 0, fat: 0, fiber: 0 },
    itemCount: 1,
    complete,
    missing: complete ? [] : ['ignoto', 'pizza'],
  });
  const resolved = (kcal: number, protein: number | null = null, origin: ResolvedTargets['origin'] = 'nutritionist'): ResolvedTargets => ({
    targets: { kcal, protein, carbs: null, fat: null, fiber: null },
    origin,
  });
  const withVeg = plan([{ weekday: 1, meals: [meal('pranzo', [['zucchine', 100]])] }]);
  const day = withVeg.days[0]!;

  it('soglia del 5%: 4,9% è in linea, 5% si segnala', () => {
    expect(DEVIATION_THRESHOLD_PCT).toBe(5);
    expect(dayObservations(withVeg, day, totals(1049), resolved(1000))).toEqual([
      { kind: 'aligned', text: 'Il piano di lunedì è in linea con i target del nutrizionista: tutti gli scarti sono sotto il 5%.' },
    ]);
    expect(dayObservations(withVeg, day, totals(1050), resolved(1000))).toEqual([
      {
        kind: 'deviation',
        text: 'Il piano di lunedì ha calorie +50 kcal rispetto al target (+5%). Se ti sembra strano, chiedi conferma al nutrizionista.',
      },
    ]);
  });

  it('segnala lo scarto maggiore', () => {
    const list = deviations(totals(1050, 88.5), resolved(1000, 100));
    expect(list.map((d) => d.field)).toEqual(['protein', 'kcal']);
    expect(dayObservations(withVeg, day, totals(1050, 88.5), resolved(1000, 100))[0]!.text).toBe(
      'Il piano di lunedì ha proteine −11,5 g rispetto al target (−12%). Se ti sembra strano, chiedi conferma al nutrizionista.',
    );
  });

  it('con valori mancanti non confronta; con target calcolati non confronta', () => {
    expect(dayObservations(withVeg, day, totals(500, 0, false), resolved(1000))).toEqual([
      { kind: 'incomplete', text: 'Non posso confrontare il piano di lunedì con i target: 2 alimenti sono senza valori nutrizionali.' },
    ]);
    expect(dayObservations(withVeg, day, totals(500), resolved(500, null, 'calculated'))).toEqual([]);
    expect(dayObservations(withVeg, day, totals(500), null)).toEqual([]);
  });

  it('giorni senza verdura', () => {
    const noVeg = plan([{ weekday: 3, meals: [meal('pranzo', [['pollo', 100]])] }, { weekday: 4, meals: [] }]);
    expect(dayObservations(noVeg, noVeg.days[0]!, totals(100), null)).toEqual([
      { kind: 'no-vegetables', text: "Nel piano di mercoledì non c'è verdura." },
    ]);
    // Un giorno senza alimenti non ha senso segnalarlo.
    expect(dayObservations(noVeg, noVeg.days[1]!, totals(0), null)).toEqual([]);
    expect(dayHasVegetables(day, withVeg.products)).toBe(true);
    expect(isVegetable('Verdure miste surgelate')).toBe(true);
    expect(isVegetable('Insalata e pomodoro')).toBe(true);
    expect(isVegetable('Piselli surgelati')).toBe(true);
    expect(isVegetable('Banana')).toBe(false);
    expect(isVegetable('Mela')).toBe(false);
  });
});
