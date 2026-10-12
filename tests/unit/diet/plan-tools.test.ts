import { describe, expect, it } from 'vitest';
import {
  addDays,
  effectiveWeekday,
  fromIsoDate,
  headerDate,
  isoWeekday,
  shortDate,
  toIsoDate,
  weekRangeLabel,
  weekStartOf,
} from '../../../src/lib/diet/calc/calendar';
import type { DietPayload } from '../../../src/lib/data/schemas/diet-payload';
import { planCompleteness } from '../../../src/lib/diet/calc/completeness';
import { currentMealKey, isEmptyMeal, mealTimeLabel, toMinutes } from '../../../src/lib/diet/calc/meal-now';
import { buildShoppingList, shoppingProgress, shoppingShareText } from '../../../src/lib/diet/calc/shopping';
import { setDayType, setProductValues, setSupplements, setTargets } from '../../../src/lib/diet/edit';
import { formatDecimal, formatInt, formatQuantity } from '../../../src/lib/diet/format';
import { parseDietImport } from '../../../src/lib/diet/import/detect';
import { myDietJson, payload, PRODUCTS } from './helpers';

const VALUES = { kcal: 100, protein: 10, carbs: 10, fat: 1, fiber: 1 };

function myDietPayload(): DietPayload {
  const result = parseDietImport(myDietJson());
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value.file;
}

describe('formati', () => {
  it('numeri all’italiana', () => {
    expect(formatInt(1812.4)).toBe('1.812');
    expect(formatInt(999)).toBe('999');
    expect(formatInt(12345)).toBe('12.345');
    expect(formatDecimal(26.94)).toBe('26,9');
    expect(formatDecimal(1, 1, true)).toBe('1');
    expect(formatDecimal(1, 1)).toBe('1,0');
    expect(formatDecimal(-11.5, 1, true)).toBe('−11,5');
  });

  it('quantità con l’unità giusta', () => {
    expect(formatQuantity('g', 715)).toBe('715 g');
    expect(formatQuantity('g', 1600)).toBe('1,6 kg');
    expect(formatQuantity('g', 1000)).toBe('1 kg');
    expect(formatQuantity('g', 1450)).toBe('1,5 kg');
    expect(formatQuantity('g', 12.5)).toBe('12,5 g');
    expect(formatQuantity('ml', 250)).toBe('250 ml');
    expect(formatQuantity('ml', 1500)).toBe('1,5 L');
    expect(formatQuantity('pz', 5)).toBe('5');
    expect(formatQuantity('pz', 1500)).toBe('1.500');
  });
});

describe('calendario e scambio del giorno', () => {
  it('giorni, settimane, etichette (ora locale)', () => {
    const monday = new Date(2026, 9, 12, 13, 0);
    const sunday = new Date(2026, 9, 18, 23, 59);
    expect(toIsoDate(monday)).toBe('2026-10-12');
    expect(fromIsoDate('2026-10-12').getDate()).toBe(12);
    expect(isoWeekday(monday)).toBe(1);
    expect(isoWeekday(sunday)).toBe(7);
    expect(weekStartOf(sunday)).toBe('2026-10-12');
    expect(weekStartOf(monday)).toBe('2026-10-12');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(weekRangeLabel('2026-10-12')).toBe('12–18 ott');
    expect(weekRangeLabel('2026-09-28')).toBe('28 set – 4 ott');
    expect(headerDate(monday)).toBe('LUN 12 OTT 2026');
    expect(shortDate(new Date(2026, 9, 8))).toBe('8 ott');
  });

  it('oggi segue il giorno scelto, se c’è uno scambio', () => {
    expect(effectiveWeekday(1, null)).toBe(1);
    expect(effectiveWeekday(1, undefined)).toBe(1);
    expect(effectiveWeekday(1, 4)).toBe(4);
  });
});

describe('pasto attuale', () => {
  const p = payload({
    products: PRODUCTS,
    days: [
      {
        weekday: 1,
        meals: [
          { key: 'colazione', label: 'Colazione', window: ['07:00', '09:00'], name: 'A', items: [] },
          { key: 'vuoto', label: 'Spuntino', window: ['10:00', '11:00'], name: '', items: [] },
          { key: 'pranzo', label: 'Pranzo', time: '13:00', window: ['12:00', '13:30'], name: 'B', items: [] },
          { key: 'cena', label: 'Cena', time: '20:30', name: 'C', items: [] },
          { key: 'tarda', label: 'Tisana', window: ['22:30', '00:30'], name: 'D', items: [] },
        ],
      },
      {
        weekday: 2,
        meals: [
          { key: 'a', label: 'A', time: '08:00', name: 'A', items: [] },
          { key: 'b', label: 'B', time: '12:00', name: 'B', items: [] },
          { key: 'c', label: 'C', name: 'Senza orario', items: [] },
        ],
      },
    ],
  });
  const [mon, tue] = p.days as [typeof p.days[0], typeof p.days[0]];

  it('in base alla finestra del pasto', () => {
    expect(currentMealKey(mon.meals, {}, toMinutes('12:30'))).toBe('pranzo');
    expect(currentMealKey(mon.meals, {}, toMinutes('07:00'))).toBe('colazione');
    expect(currentMealKey(mon.meals, {}, toMinutes('09:00'))).toBeNull();
    // Il pasto vuoto non è mai "adesso".
    expect(currentMealKey(mon.meals, {}, toMinutes('10:30'))).toBeNull();
    // Finestra a cavallo della mezzanotte.
    expect(currentMealKey(mon.meals, {}, toMinutes('00:10'))).toBe('tarda');
  });

  it('un pasto già mangiato non è più quello attuale', () => {
    expect(currentMealKey(mon.meals, { pranzo: true }, toMinutes('12:30'))).toBeNull();
    expect(currentMealKey(mon.meals, { pranzo: false }, toMinutes('12:30'))).toBe('pranzo');
  });

  it('senza finestra: da `time` all’orario del pasto successivo', () => {
    expect(currentMealKey(mon.meals, {}, toMinutes('21:00'))).toBe('cena');
    expect(currentMealKey(tue.meals, {}, toMinutes('07:59'))).toBeNull();
    expect(currentMealKey(tue.meals, {}, toMinutes('11:59'))).toBe('a');
    expect(currentMealKey(tue.meals, {}, toMinutes('12:00'))).toBe('b');
    expect(currentMealKey(tue.meals, {}, toMinutes('23:30'))).toBe('b');
    expect(currentMealKey(tue.meals, { b: true }, toMinutes('23:30'))).toBeNull();
  });

  it('orario mostrato e pasti vuoti', () => {
    expect(mealTimeLabel(mon.meals[0]!)).toBe('07:00–09:00');
    expect(mealTimeLabel(mon.meals[2]!)).toBe('13:00');
    expect(mealTimeLabel(tue.meals[2]!)).toBe('');
    expect(isEmptyMeal(mon.meals[1]!)).toBe(true);
    expect(isEmptyMeal(mon.meals[0]!)).toBe(false);
  });
});

describe('lista della spesa', () => {
  const p = payload({
    categories: ['Cereali', 'Carne'],
    products: {
      ...PRODUCTS,
      zucchine: { ...PRODUCTS.zucchine, cat: 'Frutta e verdura' },
      sale: { name: 'Sale', unit: 'g' },
      olio: { name: 'Olio', cat: 'Dispensa', unit: 'g' },
    },
    days: [
      {
        weekday: 1,
        meals: [
          { key: 'pranzo', label: 'Pranzo', items: [{ p: 'pollo', q: 150 }, { p: 'zucchine', q: 700 }, { p: 'uova', q: 2 }, { p: 'olio', q: 0.1 }] },
          { key: 'cena', label: 'Cena', items: [{ p: 'pizza', q: 1 }, { p: 'latte', q: 600 }, { p: 'sale', q: 1 }] },
        ],
      },
      {
        weekday: 2,
        meals: [
          { key: 'pranzo', label: 'Pranzo', items: [{ p: 'riso', q: 80 }, { p: 'pollo', q: 150 }, { p: 'zucchine', q: 900 }, { p: 'olio', q: 0.2 }] },
          { key: 'cena', label: 'Cena', items: [{ p: 'uova', q: 3 }, { p: 'latte', q: 600 }] },
        ],
      },
    ],
  });
  const list = buildShoppingList(p);

  it('somma per prodotto con l’unità giusta, raggruppa per reparto, esclude spesa: false', () => {
    expect(list.groups.map((g) => [g.cat, g.items.map((i) => `${i.name} ${i.text}`)])).toEqual([
      ['Cereali', ['Riso 80 g']],
      ['Carne', ['Petto di pollo 300 g']],
      ['Frutta e verdura', ['Zucchine 1,6 kg']],
      ['Uova', ['Uova 5']],
      ['Dispensa', ['Olio 0,3 g']],
      ['Latticini', ['Latte 1,2 L']],
      ['', ['Sale 1 g']],
    ]);
    expect(list.total).toBe(7);
    expect(list.excluded).toEqual([{ key: 'pizza', name: 'Pizza', cat: 'Pasto libero' }]);
    expect(list.groups.flatMap((g) => g.items).find((i) => i.key === 'olio')!.quantity).toBe(0.3);
  });

  it('avanzamento e testo da condividere (solo ciò che resta)', () => {
    const checked = { pollo: true, riso: true, zucchine: false, vecchio: true };
    expect(shoppingProgress(list, checked)).toBe(2);
    expect(shoppingShareText(list, checked, '12–18 ott')).toBe(
      [
        'Spesa · settimana 12–18 ott',
        '',
        'FRUTTA E VERDURA',
        '• Zucchine — 1,6 kg',
        '',
        'UOVA',
        '• Uova — 5',
        '',
        'DISPENSA',
        '• Olio — 0,3 g',
        '',
        'LATTICINI',
        '• Latte — 1,2 L',
        '',
        'ALTRO',
        '• Sale — 1 g',
      ].join('\n'),
    );
    const all = Object.fromEntries(list.groups.flatMap((g) => g.items.map((i) => [i.key, true])));
    expect(shoppingShareText(list, all, '12–18 ott')).toBe('Spesa · settimana 12–18 ott\n\nTutto già comprato ✓');
  });
});

describe('completamento guidato', () => {
  it('checklist e percentuale di un piano MyDiet appena importato', () => {
    const c = planCompleteness(myDietPayload());
    expect(c.percent).toBe(0);
    expect(c.untypedDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(c.missingProducts).toHaveLength(14);
    expect(c.items.map((i) => [i.id, i.label, i.done, i.counted])).toEqual([
      ['day-types', 'tipi di giornata', false, true],
      ['targets', 'target', false, true],
      ['products', 'macro per alimento', false, true],
      ['recipes', 'ricette', false, false],
      ['supplements', 'integratori', true, false],
    ]);
  });

  it('la percentuale sale compilando tipi, target e valori', () => {
    let p = myDietPayload();
    for (let d = 1; d <= 7; d++) p = setDayType(p, d, 'gym');
    // 7 giorni con tipo, 1 tipo senza target, 14 alimenti senza valori: 7 / 22.
    expect(planCompleteness(p).percent).toBe(31);
    expect(planCompleteness(p).typesWithoutTargets).toEqual(['gym']);
    p = setTargets(p, 'gym', { kcal: 1800, protein: null, carbs: null, fat: null, fiber: null }, 'manual');
    expect(planCompleteness(p).percent).toBe(36);
    for (const key of Object.keys(p.products)) p = setProductValues(p, key, VALUES, p.products[key]!.unit === 'pz' ? 60 : null);
    expect(planCompleteness(p).percent).toBe(100);
    // Un pezzo senza grammi per pezzo resta incompleto.
    p = setProductValues(p, 'uova', VALUES, null);
    expect(planCompleteness(p).missingProducts).toEqual([{ key: 'uova', name: 'Uova', reason: 'no-piece-grams' }]);
    expect(planCompleteness(p).percent).toBe(95);
  });

  it('le modifiche non toccano il piano originale; i tipi predefiniti si creano da soli', () => {
    const original = myDietPayload();
    const before = structuredClone(original);
    const p = setDayType(original, 6, 'run');
    expect(original).toEqual(before);
    expect(p.dayTypes.run).toEqual({ label: 'Corsa', targets: null, targetsSource: 'manual' });
    expect(p.days[5]!.type).toBe('run');
    expect(setDayType(p, 6, null).days[5]!.type).toBeNull();

    const withTargets = setTargets(p, 'run', { kcal: 1700, protein: 110, carbs: null, fat: null, fiber: null }, 'estimated');
    expect(withTargets.dayTypes.run).toMatchObject({ targetsSource: 'estimated', targets: { kcal: 1700 } });
    expect(setTargets(p, 'manca', null, 'manual')).toEqual(p);

    const supplements = [{ name: 'Vitamina D3', when: 'cena', dose: '2.000 UI', skip: true }];
    expect(setSupplements(p, 3, supplements).days[2]!.supplements).toEqual(supplements);
  });
});
