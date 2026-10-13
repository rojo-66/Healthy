import { describe, expect, it } from 'vitest';
import { parseDietFile } from '../../../src/lib/data/read-file';
import type { DietPlan } from '../../../src/lib/data/schemas/diet-plans';
import { parseDietImport, readDietImport, type DietImport } from '../../../src/lib/diet/import/detect';
import { dietFileName, planExportFile, planToDietFile } from '../../../src/lib/diet/import/export';
import { convertMyDiet, exportDate, titleFromDate } from '../../../src/lib/diet/import/mydiet-adapter';
import { myDietFileSchema } from '../../../src/lib/diet/import/mydiet-schema';
import { findConflict, previewDietImport } from '../../../src/lib/diet/import/preview';
import badMyDiet from '../../fixtures/invalid/mydiet-bad.json';
import { fakeFile } from '../data/helpers';
import { extendedFile, extendedJson, myDietJson } from './helpers';

function ok<T>(result: { ok: true; value: T } | { ok: false; errors: string[] }): T {
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

function errorsOf(result: { ok: boolean; errors?: string[] }): string[] {
  expect(result.ok).toBe(false);
  return result.errors ?? [];
}

const importMyDiet = (raw: unknown = myDietJson()): DietImport => ok(parseDietImport(raw));

describe('adattatore MyDiet → formato esteso', () => {
  it('converte giorni, pasti, finestre, note e prodotti', () => {
    const { file, origin, warnings } = importMyDiet();
    expect(origin).toBe('mydiet');
    expect(warnings).toEqual([]);
    expect(file.days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(file.days[0]!.variants[0]!.note).toBe('Giornata di prova: bevi molta acqua.');
    expect(file.days[0]!.defaultType).toBeNull();

    const monday = file.days[0]!.variants[0]!.meals;
    expect(monday.map((m) => [m.key, m.label])).toEqual([
      ['colazione', 'Colazione'],
      ['spuntino1', 'Spuntino'],
      ['pranzo', 'Pranzo'],
      ['spuntino2', 'Spuntino'],
      ['cena', 'Cena'],
    ]);
    expect(monday[2]).toEqual({
      key: 'pranzo',
      label: 'Pranzo',
      time: null,
      window: ['12:00', '13:30'],
      name: 'Pollo e riso',
      recipe: null,
      items: [
        { p: 'pollo', q: 150 },
        { p: 'riso', q: 80 },
        { p: 'zucchine', q: 200 },
        { p: 'olio', q: 10 },
      ],
    });

    expect(file.products.uova).toEqual({ name: 'Uova', cat: 'Latticini e uova', unit: 'pz', shop: true, per100: null, pieceGrams: null });
    expect(file.products.pizza).toMatchObject({ cat: 'Pasto libero', shop: false });
    expect(file.categories).toHaveLength(7);
  });

  it('valori nutrizionali, target, tipi di giornata e ricette restano mancanti (mai inventati)', () => {
    const { file } = importMyDiet();
    expect(Object.values(file.products).every((p) => p.per100 === null && p.pieceGrams === null)).toBe(true);
    expect(file.dayTypes).toEqual({});
    expect(file.recipes).toEqual([]);
  });

  it('tollera pasti vuoti e categorie non elencate (Integratori, Pasto libero)', () => {
    const { file } = importMyDiet();
    expect(file.days[2]!.variants[0]!.meals[3]).toMatchObject({ key: 'spuntino2', name: '', items: [] });
    expect(file.days[6]!.variants[0]!.meals[1]).toMatchObject({ key: 'spuntino1', name: '', items: [] });
    expect(file.categories).not.toContain('Integratori');
    expect(file.products.whey!.cat).toBe('Integratori');
  });

  it('gli integratori usati nei pasti diventano anche integratori del giorno', () => {
    const { file } = importMyDiet();
    expect(file.days[0]!.variants[0]!.supplements).toEqual([{ name: 'Proteine in polvere', when: 'spuntino', dose: '30 g', skip: false }]);
    expect(file.days[2]!.variants[0]!.supplements).toEqual([]);
    // Restano anche nel pasto, per i calcoli.
    expect(file.days[0]!.variants[0]!.meals[3]!.items).toEqual([{ p: 'whey', q: 30 }]);
  });

  it('titolo, validità, id e versione dal contenuto', () => {
    const { file } = importMyDiet();
    expect(file.title).toBe('Ottobre 2026');
    expect(file.validFrom).toBe('2026-10-08');
    expect(file.version).toBe(1);
    expect(file.author).toBe('');
    expect(file.id).toMatch(/^mydiet-[0-9a-f]{16}$/);
  });

  it("l'impronta è stabile: stesso contenuto (anche con chiavi in altro ordine) = stesso id; contenuto diverso = altro id", () => {
    const a = importMyDiet().file.id;
    const reordered = myDietJson();
    reordered.dieta.prodotti = Object.fromEntries(Object.entries(reordered.dieta.prodotti).reverse()) as typeof reordered.dieta.prodotti;
    reordered.esportato = '2026-11-01T10:00:00';
    expect(importMyDiet(reordered).file.id).toBe(a);

    const changed = myDietJson();
    changed.dieta.giorni[0]!.pasti.pranzo.items[0]!.q = 151;
    expect(importMyDiet(changed).file.id).not.toBe(a);
  });

  it('campi facoltativi assenti: data, nota, cat, spesa, pasti, finestre', () => {
    const raw = {
      app: 'dieta-e-spesa',
      schemaVersion: 1,
      dieta: {
        prodotti: { mela: { nome: 'Mela', unita: 'g' } },
        giorni: [{ pasti: { cena: { items: [{ p: 'mela', q: 100 }] } } }, {}],
      },
    };
    const { file, warnings } = importMyDiet(raw);
    expect(file.title).toBe('Piano MyDiet');
    expect(file.validFrom).toBeNull();
    expect(file.products.mela).toMatchObject({ cat: '', shop: true });
    expect(file.days[0]!.variants[0]!.meals).toEqual([
      { key: 'cena', label: 'Cena', time: null, window: null, name: '', recipe: null, items: [{ p: 'mela', q: 100 }] },
    ]);
    expect(file.days[1]!.variants[0]!.meals).toEqual([]);
    expect(warnings).toEqual(['Il file contiene solo 2 giorni (da lunedì).']);
  });

  it('orari non validi: il pasto resta, la finestra no, con un avviso', () => {
    const raw = myDietJson();
    raw.dieta.giorni[1]!.pasti.cena.abilita = '25:00';
    const { file, warnings } = importMyDiet(raw);
    expect(file.days[1]!.variants[0]!.meals[4]!.window).toBeNull();
    expect(warnings).toEqual(['Martedì › Cena: orari non validi, ignorati']);
  });

  it('pasti con chiavi non previste: dopo quelli noti, con un nome leggibile', () => {
    const raw = myDietJson() as unknown as { dieta: { giorni: { pasti: Record<string, unknown> }[] } };
    raw.dieta.giorni[0]!.pasti = { spuntino_sera: { nome: 'Tisana', items: [] }, ...raw.dieta.giorni[0]!.pasti };
    const { file } = importMyDiet(raw);
    expect(file.days[0]!.variants[0]!.meals.map((m) => m.label)).toEqual(['Colazione', 'Spuntino', 'Pranzo', 'Spuntino', 'Cena', 'Spuntino sera']);
  });

  it('convertMyDiet produce una bozza che va validata', () => {
    const { draft } = convertMyDiet(myDietFileSchema.parse(myDietJson()));
    expect(draft).toMatchObject({ app: 'healthy-app', kind: 'diet', schemaVersion: 3 });
    expect(parseDietFile(draft).ok).toBe(true);
  });

  it('data di esportazione e titolo', () => {
    expect(exportDate('2026-10-08T09:52:30')).toBe('2026-10-08');
    expect(exportDate('2026-02-31T00:00:00')).toBeNull();
    expect(exportDate(undefined)).toBeNull();
    expect(titleFromDate('2026-01-15')).toBe('Gennaio 2026');
    expect(titleFromDate(null)).toBe('Piano MyDiet');
  });
});

describe('riconoscimento del file ed errori', () => {
  it('formato esteso', () => {
    const imported = ok(parseDietImport(extendedJson()));
    expect(imported.origin).toBe('file');
    expect(imported.file.title).toBe('Piano di esempio');
  });

  it('MyDiet non valido: dove e perché, in italiano (nessun salvataggio possibile)', () => {
    expect(errorsOf(parseDietImport(badMyDiet))).toEqual([
      "dieta › prodotti › «pollo» › unità: valore non ammesso: scegli tra «g», «pz», «ml»",
    ]);
    const missingProduct = myDietJson();
    missingProduct.dieta.giorni[0]!.pasti.pranzo.items.push({ p: 'riso_nero', q: 50 });
    expect(errorsOf(parseDietImport(missingProduct))).toEqual([
      "Lunedì › Pranzo usa il prodotto «riso_nero» che non è nell'elenco dei prodotti",
    ]);
  });

  it('versione di MyDiet sconosciuta, file di altre app, contenuto non valido', () => {
    expect(errorsOf(parseDietImport({ ...myDietJson(), schemaVersion: 2 }))).toEqual([
      'È un file di MyDiet in un formato che questa app non conosce (formato 2, questa app legge il 1).',
    ]);
    expect(errorsOf(parseDietImport({ app: 'altro' }))).toEqual(['Questo file non è un piano alimentare di Healthy né di MyDiet.']);
    expect(errorsOf(parseDietImport([1, 2]))).toEqual(['Il file non contiene un piano alimentare.']);
    expect(errorsOf(parseDietImport({ ...extendedJson(), kind: 'workout' }))).toEqual(['Questo file è una scheda, non un piano alimentare.']);
  });

  it('troppi giorni, quantità negative', () => {
    const raw = myDietJson();
    raw.dieta.giorni.push(raw.dieta.giorni[0]!);
    expect(errorsOf(parseDietImport(raw))).toEqual(['dieta › giorni: troppi elementi: massimo 7']);
    const negative = myDietJson();
    negative.dieta.giorni[0]!.pasti.cena.items[0]!.q = -1;
    expect(errorsOf(parseDietImport(negative))).toEqual([
      'dieta › giorni › n. 1 › pasti › cena › elementi › n. 1 › quantità: valore troppo basso: minimo 0',
    ]);
  });

  it('da file: dimensione controllata prima di leggere, __proto__ rifiutato', async () => {
    const huge = fakeFile('{}', 2 * 1024 * 1024);
    expect(errorsOf(await readDietImport(huge.file))[0]).toMatch(/^Il file è troppo grande/);
    expect(huge.text).not.toHaveBeenCalled();

    const proto = JSON.stringify(myDietJson()).replace('"prodotti":{', '"prodotti":{"__proto__":{"nome":"x","unita":"g"},');
    expect(errorsOf(await readDietImport(fakeFile(proto).file))).toEqual(['Il file contiene una chiave non ammessa («__proto__»).']);

    const good = await readDietImport(fakeFile(JSON.stringify(myDietJson())).file);
    expect(good.ok).toBe(true);
  });
});

describe('anteprima e conflitti', () => {
  const plan = (id: string, version: number): DietPlan =>
    ({ id, version, title: 'Vecchio', author: '', validFrom: null, active: true, archived: false, importedAt: null, origin: 'file', payload: {} }) as unknown as DietPlan;

  it('conteggi e avvisi su ciò che manca', () => {
    const preview = previewDietImport(importMyDiet(), []);
    expect(preview).toMatchObject({ title: 'Ottobre 2026', validFrom: '2026-10-08', days: 7, meals: 33, products: 14, recipes: 0 });
    expect(preview.conflict).toEqual({ kind: 'none' });
    expect(preview.warnings).toEqual([
      'Nessun giorno ha il tipo di giornata',
      'Servono i tipi di giornata per inserire i target',
      '14 alimenti senza valori nutrizionali',
      'Nessuna ricetta nel piano',
    ]);
  });

  it('il piano esteso completo non ha avvisi', () => {
    const preview = previewDietImport({ file: extendedFile(), origin: 'file', warnings: [] }, []);
    expect(preview.warnings).toEqual([]);
    expect(preview.completeness.percent).toBe(100);
  });

  it('stesso id: versione maggiore → "newer", uguale o minore → "same-or-older"', () => {
    const incoming = { file: extendedFile(), origin: 'file' as const, warnings: [] };
    const id = incoming.file.id;
    expect(findConflict(incoming, [plan('altro', 1)])).toEqual({ kind: 'none' });
    expect(findConflict(incoming, [plan(id, 1)]).kind).toBe('newer');
    expect(findConflict(incoming, [plan(id, 2)]).kind).toBe('same-or-older');
    expect(findConflict(incoming, [plan(id, 3)]).kind).toBe('same-or-older');
  });
});

describe('esportazione', () => {
  it('esporta → reimporta: stesso piano', async () => {
    const file = extendedFile();
    const { app, kind, schemaVersion, ...rest } = file;
    void app;
    void kind;
    void schemaVersion;
    const { id, version, title, author, validFrom, ...payloadFields } = rest;
    const saved: DietPlan = {
      id,
      version,
      title,
      author,
      validFrom,
      active: true,
      archived: false,
      importedAt: '2026-10-11T08:00:00.000Z',
      origin: 'file',
      payload: payloadFields,
    };
    expect(planToDietFile(saved)).toEqual(file);

    const exported = planExportFile(saved);
    expect(exported.name).toBe('healthy-dieta-piano-di-esempio.json');
    expect(exported.type).toBe('application/json');
    const again = ok(await readDietImport(exported));
    expect(again.file).toEqual(file);
  });

  it('un piano MyDiet esportato diventa un file esteso che si reimporta uguale', () => {
    const { file } = importMyDiet();
    const exported = ok(parseDietImport(JSON.parse(JSON.stringify(file))));
    expect(exported.origin).toBe('file');
    expect(exported.file).toEqual(file);
  });

  it('nome del file', () => {
    expect(dietFileName('Ottobre 2026')).toBe('healthy-dieta-ottobre-2026.json');
    expect(dietFileName('Più proteine: è già così!')).toBe('healthy-dieta-piu-proteine-e-gia-cosi.json');
    expect(dietFileName('???')).toBe('healthy-dieta-piano.json');
  });
});
