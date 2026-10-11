import { describe, expect, it } from 'vitest';
import type { DietPlan } from '../../../src/lib/data/schemas/diet-plans';
import { toMinutes } from '../../../src/lib/diet/calc/meal-now';
import { numberToInput, parseNumberInput } from '../../../src/lib/diet/edit';
import { atPercent } from '../../../src/lib/diet/format';
import { parseDietImport } from '../../../src/lib/diet/import/detect';
import { buildDayView, dayTypeTone, weekStrip } from '../../../src/lib/diet/view';
import { planMeta } from '../../../src/routes/diet/plan-meta';
import { extendedFile, myDietJson } from './helpers';

const plan = extendedFile();
const at = (hhmm: string) => toMinutes(hhmm);

describe('vista del giorno (tab Piano)', () => {
  it('oggi alle 13:00: pasti visibili, pasto attuale, ricette, integratori, nota, osservazione', () => {
    const view = buildDayView(plan, 1, { today: true, eaten: {}, nowMinutes: at('13:00') })!;
    expect(view.meals.map((m) => [m.key, m.isNow, m.recipe])).toEqual([
      ['colazione', false, 1],
      ['spuntino1', false, null],
      ['pranzo', true, 2],
      ['spuntino2', false, null],
      ['cena', false, 3],
    ]);
    expect(view.meals[2]).toMatchObject({ label: 'Pranzo', time: '13:00', name: 'Pollo, riso e zucchine' });
    expect(view.meals[2]!.items[0]).toEqual({ name: 'Petto di pollo', quantity: '150 g', missing: false });
    expect(view.typeLabel).toBe('Palestra');
    expect(view.typeTone).toBe('training');
    expect(view.resolved?.origin).toBe('nutritionist');
    expect(Math.round(view.plan.total.kcal)).toBe(1605);
    expect(view.eatenTotals.total.kcal).toBe(0);
    expect(view.supplements.map((s) => s.skip)).toEqual([false, false, true]);
    expect(view.note).toBe('Cuoci 160 g di riso: metà oggi, metà per domani.');
    expect(view.observations.map((o) => o.kind)).toEqual(['deviation']);
  });

  it('i pasti mangiati contano solo per oggi', () => {
    const today = buildDayView(plan, 1, { today: true, eaten: { pranzo: true }, nowMinutes: at('13:00') })!;
    expect(Math.round(today.eatenTotals.total.kcal)).toBe(567);
    expect(today.meals[2]!.eaten).toBe(true);
    // Mangiato il pranzo, alle 13:00 non c'è un altro pasto "adesso".
    expect(today.meals.some((m) => m.isNow)).toBe(false);

    const other = buildDayView(plan, 2, { today: false, eaten: { pranzo: true }, nowMinutes: at('13:00') })!;
    expect(other.eatenTotals.total.kcal).toBe(0);
    expect(other.meals.every((m) => !m.eaten && !m.isNow)).toBe(true);
  });

  it('pasti vuoti nascosti; giorno non nel piano', () => {
    const wednesday = buildDayView(plan, 3, { today: false, eaten: {}, nowMinutes: 0 })!;
    expect(wednesday.meals.map((m) => m.key)).toEqual(['colazione', 'spuntino1', 'pranzo', 'cena']);
    expect(wednesday.typeTone).toBe('muted');
    const short = { ...plan, days: plan.days.slice(0, 2) };
    expect(buildDayView(short, 5, { today: false, eaten: {}, nowMinutes: 0 })).toBeNull();
  });

  it('piano MyDiet appena importato: alimenti segnalati senza valori, niente target', () => {
    const result = parseDietImport(myDietJson());
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const view = buildDayView(result.value.file, 1, { today: true, eaten: {}, nowMinutes: at('12:30') })!;
    expect(view.typeLabel).toBe('Senza tipo');
    expect(view.resolved).toBeNull();
    expect(view.meals[2]).toMatchObject({ key: 'pranzo', time: '12:00–13:30', isNow: true });
    expect(view.meals[2]!.items.every((i) => i.missing)).toBe(true);
    expect(view.plan.complete).toBe(false);
    expect(view.observations).toEqual([]);
  });

  it('colori del tipo di giornata', () => {
    expect(dayTypeTone('gym')).toBe('training');
    expect(dayTypeTone('run')).toBe('progress');
    expect(dayTypeTone('rest')).toBe('muted');
    expect(dayTypeTone(null)).toBe('muted');
    expect(dayTypeTone('altro')).toBe('muted');
  });
});

describe('striscia dei giorni', () => {
  it('kcal e tipo per giorno; oggi mostra il giorno seguito', () => {
    const strip = weekStrip(plan, 1, 1);
    expect(strip.map((d) => d.initial).join('')).toBe('LMMGVSD');
    expect(strip.map((d) => d.typeTone)).toEqual(['training', 'training', 'muted', 'training', 'training', 'progress', 'muted']);
    expect(Math.round(strip[0]!.kcal!)).toBe(1605);
    expect(strip.every((d) => d.complete && d.inPlan)).toBe(true);

    const swapped = weekStrip(plan, 1, 3);
    expect(Math.round(swapped[0]!.kcal!)).toBe(Math.round(strip[2]!.kcal!));
    expect(swapped[0]!.typeTone).toBe('muted');
  });

  it('senza valori: kcal sconosciute (null), giorni fuori dal piano', () => {
    const result = parseDietImport(myDietJson());
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(weekStrip(result.value.file, 1, 1).every((d) => d.kcal === null && !d.complete)).toBe(true);
    const short = weekStrip({ ...plan, days: plan.days.slice(0, 2) }, 1, 1);
    expect(short[4]).toMatchObject({ inPlan: false, kcal: null });
  });
});

describe('testi e campi', () => {
  it('percentuali con la preposizione giusta', () => {
    expect(atPercent(0)).toBe('allo 0%');
    expect(atPercent(36)).toBe('al 36%');
    expect(atPercent(1)).toBe("all'1%");
    expect(atPercent(8)).toBe("all'8%");
    expect(atPercent(11)).toBe("all'11%");
    expect(atPercent(85)).toBe("all'85%");
    expect(atPercent(100)).toBe('al 100%');
  });

  it('numeri scritti a mano', () => {
    expect(parseNumberInput('26,9')).toBe(26.9);
    expect(parseNumberInput(' 110 ')).toBe(110);
    expect(parseNumberInput('1.5')).toBe(1.5);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNaN();
    expect(parseNumberInput('1,2,3')).toBeNaN();
    expect(numberToInput(26.9)).toBe('26,9');
    expect(numberToInput(null)).toBe('');
  });

  it('descrizione del piano nel pannello', () => {
    const base = { version: 1, importedAt: '2026-10-08T09:00:00.000Z', author: '', origin: 'mydiet' } as DietPlan;
    expect(planMeta(base)).toBe("Da MyDiet · importato l'8 ott · v1");
    expect(planMeta({ ...base, author: 'Nutrizionista', importedAt: '2026-10-12T09:00:00.000Z', version: 2 })).toBe(
      'Nutrizionista · importato il 12 ott · v2',
    );
    expect(planMeta({ ...base, origin: 'file', importedAt: null })).toBe('Da file · v1');
  });
});
