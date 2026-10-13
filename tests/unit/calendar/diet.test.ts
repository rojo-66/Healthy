import { describe, expect, it } from 'vitest';
import { dayInfo, dayInfos, dietImpact, dietView, sourceOf, type DietContext } from '../../../src/lib/calendar/days';
import { calendarCells } from '../../../src/lib/calendar/grid';
import { applyChange, chooseDay, moveChange, skipChange, startMove } from '../../../src/lib/calendar/move';
import { buildCalendar, calendarWindow, type CalendarInput } from '../../../src/lib/calendar/occurrences';
import type { DietLogDay } from '../../../src/lib/data/schemas/diet-log';
import { dietPayloadSchema } from '../../../src/lib/data/schemas/diet-payload';
import type { DietPlan } from '../../../src/lib/data/schemas/diet-plans';
import { buildShoppingList, shoppingProgress } from '../../../src/lib/diet/calc/shopping';
import { dietDays } from '../../../src/lib/progress/diet';
import { weeklyWorkouts } from '../../../src/lib/progress/strength';
import { dayTypeFor, missingTypeText } from '../../../src/lib/today/day-type';
import variantsJson from '../../fixtures/diet-variants.json';
import { key, move, run, runLog, session, skip, TODAY, workout } from './helpers';

/**
 * La dieta segue il tipo di giornata (2c). Piano finto con varianti: lun palestra + riposo, mar palestra, mer corsa,
 * gio riposo, ven palestra + riposo, sab e dom riposo. Attività: Petto lun, Corsa mer, Spalle ven. Oggi = lunedì 12.
 */

function variantsPlan(): DietPlan {
  const { app: _a, kind: _k, schemaVersion: _s, ...payload } = structuredClone(variantsJson) as Record<string, unknown>;
  return {
    id: 'piano-varianti',
    version: 1,
    title: 'Piano con varianti',
    author: '',
    validFrom: null,
    active: true,
    archived: false,
    importedAt: '2026-10-01T08:00:00.000Z',
    origin: 'file',
    payload: dietPayloadSchema.parse(payload),
  };
}

const PETTO = workout('petto', 'Petto', [1]);
const SPALLE = workout('spalle', 'Spalle', [5]);
const CORSA = run('corsa', 'Corsa lenta', [3]);
const WINDOW = calendarWindow(TODAY);

function cal(patch: Partial<CalendarInput> = {}): CalendarInput {
  return { workouts: [PETTO, SPALLE], runs: [CORSA], edits: [], sessions: [], runLogs: [], active: null, todayIso: TODAY, ...patch };
}

function diet(patch: Partial<DietContext> = {}): DietContext {
  return { plan: variantsPlan(), logs: [], choices: [], calendarStart: null, ...patch };
}

function info(date: string, input = cal(), ctx = diet()) {
  return dayInfo(date, buildCalendar(WINDOW.from, WINDOW.to, input), input, ctx);
}

const meal = (date: string, mealKey: string, input = cal(), ctx = diet()) =>
  dietView(info(date, input, ctx), ctx.plan, { today: date === TODAY, nowMinutes: 600, keepEaten: date < TODAY })?.meals.find(
    (m) => m.key === mealKey,
  );

describe('tipo di giornata dalle attività', () => {
  it('palestra, corsa, riposo; senza schede né corse decide il piano', () => {
    expect(info(TODAY).type).toMatchObject({ key: 'gym', source: 'activities', request: 'gym' });
    expect(info('2026-10-14').type).toMatchObject({ key: 'run', label: 'Corsa' });
    expect(info('2026-10-13').type).toMatchObject({ key: 'rest', label: 'Riposo' });
    // Solo dieta: il tipo del piano (martedì palestra), come prima.
    expect(info('2026-10-13', cal({ workouts: [], runs: [] })).type).toMatchObject({ key: 'gym', source: 'plan' });
  });

  it('prima dell’aggiornamento (calendarStart) resta il tipo del piano: lo storico non cambia', () => {
    const ctx = diet({ calendarStart: TODAY });
    expect(info('2026-10-06', cal(), ctx).type).toMatchObject({ key: 'gym', source: 'plan' }); // martedì passato
    expect(info('2026-10-13', cal(), ctx).type).toMatchObject({ key: 'rest', source: 'activities' });
  });

  it('palestra e corsa nello stesso giorno: senza scelta palestra; la scelta salvata vale per quella data', () => {
    const input = cal({ edits: [move('run', 'corsa', '2026-10-14', TODAY)] });
    expect(info(TODAY, input).type).toMatchObject({ key: 'gym', double: true, source: 'activities' });
    const chosen = info(TODAY, input, diet({ choices: [{ date: TODAY, dietType: 'run' }] }));
    expect(chosen.type).toMatchObject({ key: 'run', double: true, source: 'choice' });
    // Lunedì non ha la variante corsa: pasti di mercoledì (il più vicino), con i target da corsa.
    const view = dietView(chosen, variantsPlan(), { today: true, nowMinutes: 600 })!;
    expect(view.fallback).toBe('other-day');
    expect(view.sourceWeekday).toBe(3);
    expect(view.meals.find((m) => m.key === 'colazione')?.name).toBe('Avena');
    expect(view.resolved?.targets.kcal).toBe(1600);
  });

  it('un tipo che il piano non conosce: pasti e target del piano, con la riga gialla', () => {
    const plan = variantsPlan();
    const { run: _drop, ...dayTypes } = plan.payload.dayTypes;
    const type = dayTypeFor({
      date: TODAY,
      payload: { ...plan.payload, dayTypes },
      planType: 'gym',
      activities: { gym: false, run: true },
      hasActivities: true,
      choice: null,
      calendarStart: null,
    });
    expect(type).toMatchObject({ key: 'run', missingType: 'run', request: undefined });
    expect(missingTypeText(type)).toBe('Il piano alimentare non ha un giorno corsa: pasti e target restano quelli del piano.');
  });

  it('un allenamento fatto fuori programma conta per il tipo di quel giorno', () => {
    const input = cal({ sessions: [session('altro', '2026-10-13')], todayIso: '2026-10-14' });
    expect(info('2026-10-13', input).type.key).toBe('gym');
  });
});

describe('spostamento → la dieta cambia da sola', () => {
  it('sposto l’allenamento di oggi a domani: oggi riposo, domani palestra; il riepilogo lo dice prima', () => {
    const state = chooseDay(startMove(buildCalendar(WINDOW.from, WINDOW.to, cal()).occurrences, key('workout', 'petto', TODAY), TODAY), '2026-10-13');
    const change = moveChange(state);
    const impact = dietImpact(change, cal(), diet());
    expect(impact.map((i) => [i.day, i.from.key, i.to.key])).toEqual([
      ['lun 12', 'gym', 'rest'],
      ['mar 13', 'rest', 'gym'],
    ]);
    expect(impact[0]!.kcalFrom).not.toBe(impact[0]!.kcalTo);

    const after = cal({ edits: applyChange([], change) });
    expect(meal(TODAY, 'pranzo', after)?.name).toBe('Insalata di pollo');
    expect(meal('2026-10-13', 'pranzo', after)?.name).toBe('Pollo e riso');
  });

  it('oggi con pasti già segnati: restano com’erano, cambiano solo gli altri; target ricalcolati', () => {
    const plan = variantsPlan();
    const before = info(TODAY);
    const view = dietView(before, plan, { today: true, nowMinutes: 600 })!;
    const source = sourceOf(view);
    expect(source).toEqual({ weekday: 1, type: 'gym' });
    const log: DietLogDay = {
      date: TODAY,
      planId: plan.id,
      mealsFrom: null,
      eaten: { colazione: true, spuntino1: true },
      mealSources: { colazione: source, spuntino1: source },
    };
    const ctx = diet({ logs: [log] });
    const moved = cal({ edits: [move('workout', 'petto', TODAY, '2026-10-13')] });
    const impact = dietImpact({ put: [move('workout', 'petto', TODAY, '2026-10-13')], remove: [], choicesRemove: [] }, cal(), ctx);
    expect(impact[0]).toMatchObject({ day: 'lun 12', keepsTicked: true });

    const now = dietView(info(TODAY, moved, ctx), plan, { today: true, nowMinutes: 600 })!;
    expect(now.typeKey).toBe('rest');
    expect(now.meals.map((m) => [m.key, m.name, m.eaten])).toEqual([
      ['colazione', 'Yogurt e avena', true], // segnata con la variante palestra: resta
      ['spuntino1', 'Frutto', true], // la variante riposo ha lo spuntino vuoto: resta quello segnato
      ['pranzo', 'Insalata di pollo', false],
      ['spuntino2', 'Frutto', false],
      ['cena', 'Pesce', false],
    ]);
    expect(now.resolved?.targets.kcal).toBe(1400);
    // Le kcal mangiate sono quelle dei pasti segnati, come prima dello spostamento.
    expect(now.eatenTotals.total.kcal).toBeCloseTo(view.meals.filter((m) => ['colazione', 'spuntino1'].includes(m.key)).reduce((s, m) => s + m.totals.total.kcal, 0));
  });

  it('spesa della settimana ricalcolata con gli spostamenti; le spunte (per prodotto) restano', () => {
    const plan = variantsPlan();
    const week = (input: CalendarInput) =>
      dayInfos('2026-10-12', '2026-10-18', input, diet()).infos.map((d) => ({ type: d.type.request }));
    const before = buildShoppingList(plan.payload, week(cal()));
    const after = buildShoppingList(plan.payload, week(cal({ edits: [move('workout', 'petto', TODAY, '2026-10-13')] })));
    const qty = (list: typeof before) => new Map(list.groups.flatMap((g) => g.items.map((i) => [i.key, i.quantity])));
    // Ogni giorno con la variante del suo tipo dopo lo spostamento.
    expect(week(cal({ edits: [move('workout', 'petto', TODAY, '2026-10-13')] })).map((r) => r.type)).toEqual([
      'rest',
      'gym',
      'run',
      'rest',
      'gym',
      'rest',
      'rest',
    ]);
    // Prima martedì (riposo) prendeva i pasti di lunedì; ora segue la sua variante palestra: il riso cambia.
    expect([qty(before).get('riso'), qty(after).get('riso')]).toEqual([280, 290]);
    // Saltando Spalle (venerdì riposo) le quantità cambiano.
    const skipped = buildShoppingList(plan.payload, week(cal({ edits: [skip('workout', 'spalle', '2026-10-16')] })));
    expect(qty(skipped)).not.toEqual(qty(before));
    const checked = { [before.groups[0]!.items[0]!.key]: true };
    expect(shoppingProgress(skipped, checked)).toBe(shoppingProgress(before, checked));
  });
});

describe('calendario: celle', () => {
  it('attività, spostata, fatta, saltata; tipo di dieta; % pasti nei giorni passati', () => {
    const plan = variantsPlan();
    const logs: DietLogDay[] = [{ date: '2026-10-05', planId: plan.id, mealsFrom: null, eaten: { colazione: true, pranzo: true }, mealSources: {} }];
    const input = cal({
      edits: [move('workout', 'spalle', '2026-10-09', TODAY), skip('run', 'corsa', '2026-10-14')],
      sessions: [session('petto', '2026-10-05')],
    });
    const { infos } = dayInfos(WINDOW.from, WINDOW.to, input, diet({ logs }));
    const cells = calendarCells(infos, plan, TODAY);
    const at = (date: string) => cells.find((c) => c.date === date)!;
    expect(cells).toHaveLength(21);
    expect(at('2026-10-05')).toMatchObject({ past: true, meals: { eaten: 2, planned: 5, pct: 40 } });
    expect(at('2026-10-05').activities).toEqual([expect.objectContaining({ tag: 'PET', status: 'done' })]);
    expect(at(TODAY).activities.map((a) => [a.tag, a.moved])).toEqual([
      ['PET', false],
      ['SPA', true],
    ]);
    expect(at('2026-10-14').activities[0]).toMatchObject({ kind: 'run', status: 'skipped' });
    expect(at('2026-10-14').type.key).toBe('rest');
    expect(at('2026-10-13').meals).toBeNull(); // futuro: niente %
  });
});

describe('Progressi', () => {
  it('allenamenti a settimana: fatti dove sono stati fatti; obiettivo dopo gli spostamenti; i salti contano come non fatti', () => {
    const range = { from: '2026-10-05', to: '2026-10-25' };
    const edits = [move('workout', 'spalle', '2026-10-16', '2026-10-19'), skip('run', 'corsa', '2026-10-14')];
    const w = weeklyWorkouts(
      [session('petto', '2026-10-05'), session('spalle', '2026-10-19')],
      [PETTO, SPALLE],
      range,
      TODAY,
      [CORSA],
      [runLog('corsa', '2026-10-07')],
      edits,
    );
    expect(w.weeks.map((x) => [x.monday, x.count, x.target])).toEqual([
      ['2026-10-05', 2, 3],
      ['2026-10-12', 0, 2], // Spalle spostata alla settimana dopo; la corsa saltata conta nell'obiettivo
      ['2026-10-19', 1, 4],
    ]);
  });

  it('Dieta: con il calendario ogni giorno usa la variante del suo tipo; prima di calendarStart come prima', () => {
    const plan = variantsPlan();
    const logs: DietLogDay[] = [
      { date: '2026-10-06', planId: plan.id, mealsFrom: null, eaten: { colazione: true }, mealSources: {} },
      { date: '2026-10-08', planId: plan.id, mealsFrom: null, eaten: { colazione: true }, mealSources: {} },
    ];
    const input = cal({ todayIso: '2026-10-09' });
    const legacy = dietDays([plan], logs, '2026-10-09');
    const before = dietDays([plan], logs, '2026-10-09', { input, choices: [], calendarStart: '2026-10-07' });
    // Martedì 6 (prima dell'aggiornamento): identico a prima.
    expect(before.find((d) => d.date === '2026-10-06')).toEqual(legacy.find((d) => d.date === '2026-10-06'));
    // Giovedì 8 (dopo): nessuna attività → riposo, come il piano; mercoledì 7 corsa.
    expect(before.find((d) => d.date === '2026-10-08')?.targets?.kcal).toBe(1400);
    // Lunedì 5 dopo un calendario attivo da sempre: Petto → palestra.
    const always = dietDays([plan], logs, '2026-10-09', { input, choices: [], calendarStart: null });
    expect(always.find((d) => d.date === '2026-10-06')?.targets?.kcal).toBe(1400); // martedì senza attività: riposo
  });
});

describe('skip dalla Home: la dieta del giorno torna riposo', () => {
  it('saltare la corsa di mercoledì', () => {
    const occ = buildCalendar(WINDOW.from, WINDOW.to, cal()).occurrences.find((o) => o.key === key('run', 'corsa', '2026-10-14'))!;
    const after = cal({ edits: applyChange([], skipChange(occ)) });
    expect(info('2026-10-14', after).type.key).toBe('rest');
  });
});
