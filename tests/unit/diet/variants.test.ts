import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dietFileV2ToV3, dietPayloadV2ToV3 } from '../../../src/lib/data/migrations/diet-v3';
import { parseDietFile } from '../../../src/lib/data/read-file';
import { dietPayloadSchema, type DietPayload } from '../../../src/lib/data/schemas/diet-payload';
import { planCompleteness } from '../../../src/lib/diet/calc/completeness';
import { buildShoppingList } from '../../../src/lib/diet/calc/shopping';
import { selectableDayTypes, setDayType, setSupplements } from '../../../src/lib/diet/edit';
import { parseDietImport } from '../../../src/lib/diet/import/detect';
import { planToDietFile } from '../../../src/lib/diet/import/export';
import { templateContent } from '../../../src/lib/diet/template/template';
import { nearestWeekdays, resolveDietDay } from '../../../src/lib/diet/variants';
import { buildDayView, findDay, weekStrip } from '../../../src/lib/diet/view';
import { canonicalJson } from '../../../src/lib/share/canonical';
import variantsFixture from '../../fixtures/diet-variants.json';
import { extendedJson, myDietJson } from './helpers';

/**
 * 2b: piano alimentare v3 con le varianti per tipo di giornata. Scelta della variante (con le regole di ripiego),
 * regole dello schema, import (v3, v2, MyDiet, modello per Claude), modifiche, spesa, completezza, esportazione.
 */

const OPTIONS = { today: new Date(2026, 9, 12, 9, 0), newId: () => 'id-nuovo' };

function variantsPayload(): DietPayload {
  const result = parseDietFile(structuredClone(variantsFixture));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

const mealNames = (p: DietPayload, weekday: number, request = {}) => findDay(p, weekday, request)!.meals.map((m) => m.name);

describe('scelta della variante', () => {
  const p = variantsPayload();

  it('senza richiesta: la variante del tipo predefinito, con i tipi disponibili', () => {
    const monday = resolveDietDay(p, 1)!;
    expect(monday).toMatchObject({ weekday: 1, type: 'gym', defaultType: 'gym', variantTypes: ['gym', 'rest'], fallback: 'none' });
    expect(monday.note).toBe('Lunedì palestra di prova.');
    expect(monday.supplements.map((s) => s.name)).toEqual(['Creatina']);
  });

  it('tipo richiesto che il giorno ha: quella variante', () => {
    const rest = resolveDietDay(p, 1, { type: 'rest' })!;
    expect(rest).toMatchObject({ type: 'rest', fallback: 'none', source: { weekday: 1, type: 'rest' } });
    expect(rest.note).toBe('Lunedì riposo di prova.');
    expect(rest.meals[2]!.name).toBe('Insalata di pollo');
  });

  it('ripiego: il giorno più vicino che ha la variante (settimana circolare, a parità il successivo)', () => {
    expect(nearestWeekdays(3)).toEqual([4, 2, 5, 1, 6, 7]);
    expect(nearestWeekdays(7)).toEqual([1, 6, 2, 5, 3, 4]);
    // Martedì riposo: lunedì e mercoledì a distanza 1; mercoledì non ce l'ha, lunedì sì.
    expect(resolveDietDay(p, 2, { type: 'rest' })).toMatchObject({ fallback: 'other-day', source: { weekday: 1, type: 'rest' }, type: 'rest' });
    // Giovedì palestra: venerdì (dopo) e mercoledì (prima) a distanza 1 → venerdì, che ce l'ha.
    expect(resolveDietDay(p, 4, { type: 'gym' })).toMatchObject({ fallback: 'other-day', source: { weekday: 5 } });
    // Domenica palestra: lunedì è a distanza 1 (settimana circolare).
    expect(resolveDietDay(p, 7, { type: 'gym' })).toMatchObject({ fallback: 'other-day', source: { weekday: 1 } });
    // Il giorno appiattito resta del giorno richiesto (nome nelle osservazioni), i pasti sono dell'altro.
    expect(resolveDietDay(p, 7, { type: 'gym' })!.weekday).toBe(7);
    expect(mealNames(p, 7, { type: 'gym' })).toEqual(mealNames(p, 1));
  });

  it('nessun giorno ha la variante: pasti predefiniti, target del tipo richiesto, avviso', () => {
    const noRun = variantsPayload();
    noRun.days[2] = { weekday: 3, defaultType: 'rest', variants: [noRun.days[3]!.variants[0]!] };
    const thursday = resolveDietDay(noRun, 4, { type: 'run' })!;
    expect(thursday).toMatchObject({ fallback: 'no-variant', type: 'run', source: { weekday: 4, type: 'rest' } });
    const view = buildDayView(noRun, 4, { today: false, eaten: {}, nowMinutes: 0, type: 'run' })!;
    expect(view.resolved?.targets.kcal).toBe(1600); // target da corsa
    expect(view.fallback).toBe('no-variant');
    expect(view.meals.map((m) => m.name)).toEqual(buildDayView(noRun, 4, { today: false, eaten: {}, nowMinutes: 0 })!.meals.map((m) => m.name));
  });

  it('pasti di un altro giorno fissati per la data (scambio migrato): stessi pasti e kcal di quel giorno', () => {
    const swapped = buildDayView(p, 1, { today: true, eaten: {}, nowMinutes: 600, mealsFrom: { weekday: 3, type: null } })!;
    const wednesday = buildDayView(p, 3, { today: true, eaten: {}, nowMinutes: 600 })!;
    expect(swapped.meals.map((m) => m.name)).toEqual(wednesday.meals.map((m) => m.name));
    expect(swapped.plan.total.kcal).toBeCloseTo(wednesday.plan.total.kcal);
    expect(swapped.weekday).toBe(3); // il giorno seguito, come prima del formato v3
    expect(swapped.typeKey).toBe('run');
    expect(swapped.fallback).toBe('none');
  });

  it('giorno fuori dal piano: nessuna variante', () => {
    expect(resolveDietDay({ days: variantsPayload().days.slice(0, 2) }, 5)).toBeNull();
  });

  it('striscia: la variante in uso di ogni giorno', () => {
    const strip = weekStrip(p);
    expect(strip.map((d) => d.typeTone)).toEqual(['training', 'training', 'progress', 'muted', 'training', 'muted', 'muted']);
  });
});

describe('regole dello schema v3', () => {
  const errorsOf = (days: unknown[]) => {
    const r = dietPayloadSchema.safeParse({ ...variantsPayload(), days });
    expect(r.success).toBe(false);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };
  const variant = (type: string | null) => ({ type, meals: [] });

  it('due varianti dello stesso tipo, una senza tipo con altre, predefinito senza variante, tipo sconosciuto, massimo 3', () => {
    expect(errorsOf([{ weekday: 1, defaultType: 'gym', variants: [variant('gym'), variant('gym')] }])).toContain(
      'Lunedì: due varianti dello stesso tipo («palestra»)',
    );
    expect(errorsOf([{ weekday: 1, defaultType: 'gym', variants: [variant('gym'), variant(null)] }])).toContain(
      'Lunedì: più varianti, ma una non ha il tipo di giornata',
    );
    expect(errorsOf([{ weekday: 1, defaultType: 'run', variants: [variant('gym')] }])).toContain(
      'Lunedì: manca la variante del tipo predefinito (corsa)',
    );
    expect(errorsOf([{ weekday: 1, defaultType: 'gym', variants: [variant('gym'), variant('nuoto')] }])).toContain(
      'Lunedì: il tipo di giornata «nuoto» non è tra i tipi di giornata',
    );
    expect(errorsOf([{ weekday: 1, defaultType: null, variants: [variant('gym'), variant('rest')] }])).toContain(
      'Lunedì: manca il tipo predefinito (defaultType) tra quelli delle varianti',
    );
    const four = errorsOf([{ weekday: 1, defaultType: 'gym', variants: [variant('gym'), variant('run'), variant('rest'), variant('altro')] }]);
    expect(four.length).toBeGreaterThan(0);
    expect(errorsOf([{ weekday: 1, defaultType: null, variants: [] }]).length).toBeGreaterThan(0);
  });

  it('una sola variante senza tipo (MyDiet, completamento guidato) è valida', () => {
    const r = dietPayloadSchema.safeParse({ ...variantsPayload(), days: [{ weekday: 1, defaultType: null, variants: [variant(null)] }] });
    expect(r.success).toBe(true);
  });
});

describe('import', () => {
  it('v3 con varianti: si importa così com’è', () => {
    const r = parseDietImport(structuredClone(variantsFixture), OPTIONS);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.value.file.days[0]!.variants.map((v) => v.type)).toEqual(['gym', 'rest']);
    expect(r.value.warnings).toEqual([]);
  });

  it('v2 (un menu per giorno): ogni giorno diventa una variante sola, con gli stessi dati', () => {
    const v2 = extendedJson();
    const r = parseDietImport(structuredClone(v2), OPTIONS);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.value.file.schemaVersion).toBe(3);
    r.value.file.days.forEach((day, i) => {
      const old = v2.days[i]!;
      expect(day.defaultType).toBe(old.type ?? null);
      expect(day.variants).toHaveLength(1);
      expect(day.variants[0]!.type).toBe(old.type ?? null);
      expect(day.variants[0]!.meals.map((m) => m.key)).toEqual(old.meals.map((m) => m.key));
    });
  });

  it('MyDiet: una variante per giorno senza tipo, da completare', () => {
    const r = parseDietImport(myDietJson(), OPTIONS);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.value.file.days.every((d) => d.defaultType === null && d.variants.length === 1 && d.variants[0]!.type === null)).toBe(true);
  });

  it('un giorno scritto ancora nella forma v2 in un file v3 viene convertito; una sola variante prende il tipo predefinito', () => {
    const raw = structuredClone(variantsFixture) as unknown as { days: Record<string, unknown>[] };
    raw.days[1] = { weekday: 2, type: 'gym', meals: [] };
    raw.days[3] = { weekday: 4, defaultType: 'rest', variants: [{ type: '', meals: [] }] };
    const r = parseDietImport(raw, OPTIONS);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.value.file.days[1]).toMatchObject({ defaultType: 'gym', variants: [{ type: 'gym' }] });
    expect(r.value.file.days[3]).toMatchObject({ defaultType: 'rest', variants: [{ type: 'rest' }] });
  });

  it('file più nuovo (v4): "aggiorna Healthy"', () => {
    const r = parseDietImport({ ...structuredClone(variantsFixture), schemaVersion: 4 }, OPTIONS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/aggiorna Healthy/);
  });
});

describe('modello per Claude v3', () => {
  it('istruzioni sulle varianti ed esempio di un giorno con due varianti valido', () => {
    const model = templateContent(OPTIONS.today) as { _istruzioni: string[]; _esempio: { day: unknown } };
    const text = model._istruzioni.join('\n');
    expect(text).toContain('copia quel menu nella variante corrispondente di TUTTI i giorni');
    expect(text).toContain('crea per quel giorno SOLO la variante del suo tipo di giornata');
    expect(text).toContain('MAI INVENTARE VARIANTI');
    expect(text).toContain("chiedilo all'utente");
    const withExample = dietPayloadSchema.safeParse({
      ...variantsPayload(),
      products: { ...variantsPayload().products, alimento_esempio: { name: 'x', unit: 'g' }, frutto_esempio: { name: 'y', unit: 'pz' } },
      recipes: [{ n: 1, name: 'Ricetta di esempio' }],
      days: [model._esempio.day],
    });
    expect(withExample.success).toBe(true);
  });

  it('compilato da una dieta "allenamento / riposo": due varianti in tutti i giorni, predefinito dal documento', () => {
    const raw = JSON.parse(readFileSync('tests/fixtures/diet-claude-filled-v3.json', 'utf8'));
    const r = parseDietImport(raw, OPTIONS);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    const { file } = r.value;
    expect(file.id).toBe('id-nuovo');
    expect(file.days.map((d) => d.defaultType)).toEqual(['gym', 'rest', 'gym', 'rest', 'gym', 'rest', 'rest']);
    expect(file.days.every((d) => d.variants.map((v) => v.type).join() === 'gym,rest')).toBe(true);
    // "run" vuoto e senza varianti: tolto.
    expect(Object.keys(file.dayTypes).sort()).toEqual(['gym', 'rest']);
  });

  it('il modello vecchio (v2) vuoto è ancora riconosciuto come modello vuoto', () => {
    const v2 = { app: 'healthy-app', kind: 'diet', schemaVersion: 2, _modello: true, products: {}, days: [{ weekday: 1, type: null, meals: [{ name: '', items: [] }] }] };
    const r = parseDietImport(v2, OPTIONS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(['Questo è il modello vuoto: compilalo prima con Claude']);
  });
});

describe('modifiche, spesa, completezza, esportazione', () => {
  it('tipo predefinito: con una sola variante anche la variante; con più varianti solo tra i tipi del giorno', () => {
    const r = parseDietImport(myDietJson(), OPTIONS);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    const typed = setDayType(r.value.file, 2, 'gym');
    expect(typed.days[1]).toMatchObject({ defaultType: 'gym', variants: [{ type: 'gym' }] });
    expect(selectableDayTypes(typed, 2)).toBeNull();

    const p = variantsPayload();
    expect(selectableDayTypes(p, 1)).toEqual(['gym', 'rest']);
    expect(setDayType(p, 1, 'rest').days[0]!.defaultType).toBe('rest');
    // Un tipo che il giorno non ha: invariato (le varianti arrivano solo dal file).
    expect(setDayType(p, 1, 'run').days[0]).toEqual(p.days[0]);
  });

  it('integratori per variante', () => {
    const p = variantsPayload();
    const list = [{ name: 'Magnesio', when: 'cena', dose: '1', skip: false }];
    const next = setSupplements(p, 1, list, 'rest');
    expect(next.days[0]!.variants[1]!.supplements).toEqual(list);
    expect(next.days[0]!.variants[0]!.supplements.map((s) => s.name)).toEqual(['Creatina']);
    // Senza tipo: la variante predefinita.
    expect(setSupplements(p, 1, list).days[0]!.variants[0]!.supplements).toEqual(list);
  });

  it('spesa della settimana: le varianti predefinite (gli spostamenti arrivano in 2c)', () => {
    const p = variantsPayload();
    const list = buildShoppingList(p);
    const riso = list.groups.flatMap((g) => g.items).find((i) => i.key === 'riso');
    // Riso solo nelle varianti palestra predefinite (lun 80, mar 90, ven 100) e nella corsa di mercoledì (100).
    expect(riso?.quantity).toBe(370);
  });

  it('completezza: giorni senza tipo e prodotti di tutte le varianti', () => {
    const p = variantsPayload();
    expect(planCompleteness(p).untypedDays).toEqual([]);
    const r = parseDietImport(myDietJson(), OPTIONS);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(planCompleteness(r.value.file).untypedDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('esportazione: file v3 con le varianti, che si reimporta identico', () => {
    const p = variantsPayload();
    const file = planToDietFile({
      id: 'p',
      version: 1,
      title: 'T',
      author: '',
      validFrom: null,
      active: true,
      archived: false,
      importedAt: null,
      origin: 'file',
      payload: p,
    });
    expect(file.schemaVersion).toBe(3);
    const back = parseDietFile(JSON.parse(JSON.stringify(file)));
    expect(back.ok && canonicalJson(back.value)).toBe(canonicalJson(file));
  });
});

describe('non regressione: un piano v2 migrato dà gli stessi pasti, kcal, spesa di prima', () => {
  it('ogni giorno appiattito ha i dati del giorno v2', () => {
    const v2 = extendedJson();
    const p = dietPayloadSchema.parse(dietPayloadV2ToV3(structuredClone(v2) as unknown as Record<string, unknown>));
    for (const old of v2.days) {
      const day = findDay(p, old.weekday)!;
      expect(day.type).toBe(old.type ?? null);
      expect(day.meals.map((m) => [m.key, m.items.length])).toEqual(old.meals.map((m) => [m.key, m.items.length]));
      expect(day.note).toBe(old.note ?? '');
    }
    // La spesa somma gli stessi alimenti: confronto con la somma fatta a mano sul file v2.
    const expected = new Map<string, number>();
    for (const d of v2.days) for (const m of d.meals) for (const i of m.items) expected.set(i.p, (expected.get(i.p) ?? 0) + i.q);
    for (const item of buildShoppingList(p).groups.flatMap((g) => g.items)) {
      expect(item.quantity).toBeCloseTo(expected.get(item.key) ?? -1);
    }
    expect(dietFileV2ToV3({ schemaVersion: 2, days: [] }).schemaVersion).toBe(3);
  });
});
