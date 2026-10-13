// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveImportedPlan } from '../../../src/lib/data/repo/diet-plans';
import { dietFileSchema } from '../../../src/lib/data/schemas/diet-file';
import {
  dayTypeSchema,
  daySchema,
  dietPayloadShape,
  mealSchema,
  variantSchema,
  nutrientsSchema,
  productSchema,
  recipeSchema,
  supplementSchema,
  targetsSchema,
} from '../../../src/lib/data/schemas/diet-payload';
import { planCompleteness } from '../../../src/lib/diet/calc/completeness';
import { parseDietImport, type DietImport } from '../../../src/lib/diet/import/detect';
import { planToDietFile } from '../../../src/lib/diet/import/export';
import { previewDietImport } from '../../../src/lib/diet/import/preview';
import type { NormalizeOptions } from '../../../src/lib/diet/import/tolerant';
import {
  CLAUDE_PROMPT,
  EMPTY_TEMPLATE_MESSAGE,
  TEMPLATE_FILE_NAME,
  templateContent,
  templateFile,
} from '../../../src/lib/diet/template/template';
import { compactForLink } from '../../../src/lib/share/canonical';
import { encodeShare } from '../../../src/lib/share/codec';
import { readSharedFile, readSharedPayload, readSharedText } from '../../../src/lib/share/import/detect';
import { fakeFile, resetDb } from '../data/helpers';
import { BASE, smallDietFile } from '../share/helpers';

const TEMPLATE_PATH = 'src/lib/diet/template/healthy-dieta-modello.json';
const FIXTURE_PATH = 'tests/fixtures/diet-claude-filled.json';
// Lunedì 12 ottobre 2026.
const TODAY = new Date(2026, 9, 12, 9, 0);
const OPTIONS: NormalizeOptions = { today: TODAY, newId: () => 'id-generato' };

type Json = Record<string, any>;

const fixtureText = () => readFileSync(FIXTURE_PATH, 'utf8');
const fixture = (): Json => JSON.parse(fixtureText());

function ok<T>(result: { ok: true; value: T } | { ok: false; errors: string[] }): T {
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

function errorsOf(result: { ok: boolean; errors?: string[] }): string[] {
  expect(result.ok).toBe(false);
  return result.errors ?? [];
}

const importDiet = (raw: unknown): DietImport => ok(parseDietImport(raw, OPTIONS));
const dietErrors = (raw: unknown): string[] => errorsOf(parseDietImport(raw, OPTIONS));

/** Il modello compilato "a mano" nel test con dati FINTI: un prodotto, un pasto, un tipo di giornata. */
function filledTemplate(): Json {
  const copy = templateContent(TODAY) as Json;
  copy.title = 'Prova compilata';
  copy.products = {
    prova: { name: 'Alimento finto', cat: 'Altro', unit: 'g', shop: true, per100: null, pieceGrams: null },
  };
  for (const day of copy.days) {
    day.defaultType = 'rest';
    day.variants[0].type = 'rest';
    day.variants[0].meals[2].name = 'Pranzo finto';
    day.variants[0].meals[2].items = [{ p: 'prova', q: 100 }];
  }
  return copy;
}

const sortedKeys = (value: object) => Object.keys(value).sort();

describe('modello per Claude: il file', () => {
  it('è JSON valido, vuoto e senza dati reali', () => {
    const raw = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8')) as Json;
    expect(raw).toMatchObject({ app: 'healthy-app', kind: 'diet', schemaVersion: 3, _modello: true, id: '', title: '' });
    expect(raw.products).toEqual({});
    expect(raw.recipes).toEqual([]);
    expect(raw.generalNotes).toBe('');
    expect(raw.days.map((d: Json) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const day of raw.days) {
      // v3 (2b): tipo predefinito e una sola variante, entrambi da compilare.
      expect(day.defaultType).toBeNull();
      expect(day.variants).toHaveLength(1);
      const variant = day.variants[0];
      expect(variant.type).toBeNull();
      expect(variant.supplements).toEqual([]);
      expect(variant.meals.map((m: Json) => m.key)).toEqual(['colazione', 'spuntino1', 'pranzo', 'spuntino2', 'cena']);
      for (const meal of variant.meals) expect(meal).toMatchObject({ name: '', items: [], time: null, window: null, recipe: null });
    }
    for (const type of Object.values(raw.dayTypes) as Json[]) expect(type.targets).toBeNull();
  });

  it('combacia con lo schema zod: stessi campi del piano esteso e degli esempi', () => {
    const raw = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8')) as Json;
    const fileKeys = ['app', 'kind', 'schemaVersion', 'id', 'version', 'title', 'author', 'validFrom', ...Object.keys(dietPayloadShape)];
    expect(sortedKeys(raw).filter((k) => !k.startsWith('_'))).toEqual(fileKeys.sort());

    const example = raw._esempio as Json;
    for (const product of Object.values(example.products) as Json[]) {
      expect(sortedKeys(product)).toEqual(sortedKeys(productSchema.shape));
      if (product.per100) expect(sortedKeys(product.per100)).toEqual(sortedKeys(nutrientsSchema.shape));
      expect(productSchema.safeParse(product).success).toBe(true);
    }
    // `targetsSource` lo gestisce l'app (completamento guidato): non va nel modello.
    expect(sortedKeys(example.dayType)).toEqual(sortedKeys(dayTypeSchema.shape).filter((k) => k !== 'targetsSource'));
    expect(sortedKeys(example.dayType.targets)).toEqual(sortedKeys(targetsSchema.shape));
    expect(sortedKeys(example.meal)).toEqual(sortedKeys(mealSchema.shape));
    expect(sortedKeys(example.supplement)).toEqual(sortedKeys(supplementSchema.shape));
    expect(sortedKeys(example.recipe)).toEqual(sortedKeys(recipeSchema.shape));
    for (const part of [
      [dayTypeSchema, example.dayType],
      [mealSchema, example.meal],
      [supplementSchema, example.supplement],
      [recipeSchema, example.recipe],
    ] as const) {
      expect(part[0].safeParse(part[1]).success).toBe(true);
    }
    expect(sortedKeys(raw.days[0])).toEqual(sortedKeys(daySchema.shape));
    expect(sortedKeys(raw.days[0].variants[0])).toEqual(sortedKeys(variantSchema.shape));
    expect(sortedKeys(raw.days[0].variants[0].meals[0])).toEqual(sortedKeys(mealSchema.shape));
  });

  it('il download è una copia profonda con _modello e la data di oggi', () => {
    const first = templateContent(TODAY) as Json;
    expect(first._modello).toBe(true);
    expect(first._generato).toBe('2026-10-12');
    first.days[0].variants[0].meals[0].name = 'modificato';
    first._istruzioni.push('modificato');
    const second = templateContent(TODAY) as Json;
    expect(second.days[0].variants[0].meals[0].name).toBe('');
    expect(second._istruzioni).not.toContain('modificato');
  });

  it('file healthy-dieta-modello.json in JSON', async () => {
    const file = templateFile(TODAY);
    expect(file.name).toBe(TEMPLATE_FILE_NAME);
    expect(file.name).toBe('healthy-dieta-modello.json');
    expect(file.type).toBe('application/json');
    expect(JSON.parse(await file.text())).toEqual(templateContent(TODAY));
  });

  it('il messaggio per Claude nomina il modello', () => {
    expect(CLAUDE_PROMPT).toBe(
      'Ti allego la mia dieta e il modello healthy-dieta-modello.json. Compila il modello seguendo le istruzioni che contiene e restituiscimi il file JSON completo da scaricare. Poi elencami cosa mancava nella dieta.',
    );
  });
});

describe('modello per Claude: import', () => {
  it('il modello vuoto si riconosce e non si importa', async () => {
    expect(dietErrors(templateContent(TODAY))).toEqual([EMPTY_TEMPLATE_MESSAGE]);
    const raw = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8'));
    expect(dietErrors(raw)).toEqual([EMPTY_TEMPLATE_MESSAGE]);
    const { file } = fakeFile(JSON.stringify(templateContent(TODAY)));
    expect(errorsOf(await readSharedFile(file))).toEqual([EMPTY_TEMPLATE_MESSAGE]);
  });

  it('il modello compilato con dati finti supera la validazione; i campi _… sono ignorati', () => {
    const { file, warnings } = importDiet(filledTemplate());
    expect(Object.keys(file).filter((k) => k.startsWith('_'))).toEqual([]);
    expect(file.title).toBe('Prova compilata');
    expect(file.days).toHaveLength(7);
    // Tipi non usati e vuoti (gym, run) tolti; quello usato resta, senza target.
    expect(Object.keys(file.dayTypes)).toEqual(['rest']);
    expect(file.dayTypes.rest?.targets).toBeNull();
    expect(warnings).toEqual([]);
    // Lo stesso file passa anche lo schema puro, una volta tolti i "vuoti" del modello.
    expect(dietFileSchema.safeParse(file).success).toBe(true);
  });

  it('_modello rimasto in un file compilato non lo blocca', () => {
    const raw = filledTemplate();
    raw._modello = true;
    expect(importDiet(raw).file.title).toBe('Prova compilata');
  });

  it('id vuoto → uuid nuovo, versione assente → 1, titolo vuoto → "Piano del <oggi>"', () => {
    const raw = filledTemplate();
    raw.id = '  ';
    delete raw.version;
    raw.title = '';
    const { file } = importDiet(raw);
    expect(file.id).toBe('id-generato');
    expect(file.version).toBe(1);
    expect(file.title).toBe('Piano del 12/10/2026');

    // Senza opzioni: un uuid vero.
    const real = ok(parseDietImport(filledTemplate()));
    expect(real.file.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('null e "" sono dati mancanti (mai zero) e finiscono nel completamento guidato', () => {
    const { file, warnings } = importDiet(fixture());
    expect(file.id).toBe('id-generato');
    expect(file.validFrom).toBeNull();
    expect(file.generalNotes).toMatch(/^Indicazioni di prova/);
    // "run" vuoto e inutilizzato: tolto. "rest" usato e senza target: resta mancante.
    expect(Object.keys(file.dayTypes).sort()).toEqual(['gym', 'rest']);
    expect(file.dayTypes.rest?.targets).toBeNull();
    expect(file.products.banana_esempio?.per100).toBeNull();
    expect(file.products.latte_esempio?.per100).toBeNull();
    expect(file.products.yogurt_esempio?.per100?.fiber).toBeNull();
    const tuesday = file.days[1]!.variants[0]!;
    expect(file.days[1]!.defaultType).toBeNull();
    expect(tuesday.type).toBeNull();
    expect(tuesday.meals[0]!.time).toBeNull();
    expect(tuesday.meals[2]!.window).toBeNull();
    expect(file.days[0]!.variants[0]!.note).toContain('In alternativa');
    expect(warnings).toEqual([]);

    const completeness = planCompleteness(file);
    expect(completeness.untypedDays).toEqual([2]);
    expect(completeness.typesWithoutTargets).toEqual(['rest']);
    expect(completeness.missingProducts.map((p) => p.key)).toEqual(['latte_esempio', 'banana_esempio', 'zucchine_esempio']);
    expect(completeness.percent).toBeLessThan(100);

    const preview = previewDietImport({ file, origin: 'file', warnings }, []);
    expect(preview.warnings).toEqual([
      'Martedì: manca il tipo di giornata',
      'Mancano i target di un tipo di giornata',
      '3 alimenti senza valori nutrizionali',
    ]);
  });

  it('tipi di giornata inutilizzati ma con i target del nutrizionista restano (servono nel completamento)', () => {
    const raw = filledTemplate();
    raw.dayTypes.gym.targets = { kcal: 2000, protein: null, carbs: null, fat: null, fiber: null };
    const { file } = importDiet(raw);
    expect(Object.keys(file.dayTypes).sort()).toEqual(['gym', 'rest']);
    expect(file.dayTypes.gym?.targets?.kcal).toBe(2000);
    expect(planCompleteness(file).typesWithoutTargets).toEqual(['rest']);
  });

  it('meno di 7 giorni: avviso, l’import resta possibile', () => {
    const raw = filledTemplate();
    raw.days = raw.days.filter((d: Json) => d.weekday !== 4 && d.weekday !== 7);
    const { file, warnings } = importDiet(raw);
    expect(file.days).toHaveLength(5);
    expect(warnings).toEqual(['Mancano giovedì e domenica: in quei giorni il piano sarà vuoto']);
    const six = filledTemplate();
    six.days = six.days.filter((d: Json) => d.weekday !== 4);
    expect(importDiet(six).warnings).toEqual(['Manca giovedì: quel giorno il piano sarà vuoto']);
  });

  it('fascia oraria con un solo estremo: ignorata con avviso', () => {
    const raw = filledTemplate();
    raw.days[0].variants[0].meals[2].window = ['12:00', ''];
    const { file, warnings } = importDiet(raw);
    expect(file.days[0]!.variants[0]!.meals[2]!.window).toBeNull();
    expect(warnings).toEqual(['Lunedì › Pranzo: fascia oraria incompleta, ignorata']);
  });
});

describe('modello per Claude: errori tipici, ciascuno con il suo messaggio', () => {
  it('valori per 100 g a metà', () => {
    const raw = filledTemplate();
    raw.products.prova.per100 = { kcal: null, protein: 10, carbs: 5, fat: null, fiber: null };
    expect(dietErrors(raw)).toEqual([
      'Alimento finto: valori per 100 g incompleti (mancano kcal e grassi): completali o lasciali tutti null',
    ]);
  });

  it('target senza kcal', () => {
    const raw = filledTemplate();
    raw.dayTypes.rest.targets = { kcal: null, protein: 120, carbs: null, fat: null, fiber: null };
    expect(dietErrors(raw)).toEqual(['Riposo: target senza kcal: aggiungi le kcal o lascia tutti i target a null']);
  });

  it('prodotto usato nei pasti ma assente in products', () => {
    const raw = filledTemplate();
    raw.days[0].variants[0].meals[0].items = [{ p: 'fantasma', q: 50 }];
    expect(dietErrors(raw)).toEqual(["Lunedì › Colazione usa il prodotto «fantasma» che non è nell'elenco dei prodotti"]);
  });

  it('giorno duplicato', () => {
    const raw = filledTemplate();
    raw.days[1].weekday = 1;
    const errors = dietErrors(raw);
    expect(errors).toContain('Lunedì compare due volte');
  });

  it('weekday fuori da 1–7', () => {
    const raw = filledTemplate();
    raw.days[6].weekday = 8;
    expect(dietErrors(raw)).toEqual(['giorni › n. 7 › giorno: giorno non valido: usa 1 = lunedì … 7 = domenica']);
  });

  it('numero scritto come testo con la virgola', () => {
    const raw = filledTemplate();
    raw.days[0].variants[0].meals[2].items[0].q = '1,5';
    expect(dietErrors(raw)).toEqual([
      'giorni › n. 1 › varianti › n. 1 › pasti › n. 3 › elementi › n. 1 › quantità: numero scritto con la virgola («1,5»): usa il punto (1.5), senza virgolette',
    ]);
  });

  it('virgola finale e decimale con la virgola nel JSON: righe indicate, nulla indovinato', async () => {
    const trailing = '{\n  "app": "healthy-app",\n  "kind": "diet",\n}';
    const errors = errorsOf(await readSharedFile(fakeFile(trailing).file));
    expect(errors[0]).toMatch(/^Il file non è un JSON valido/);
    expect(errors).toContain("Riga 3: c'è una virgola di troppo prima di «}»");

    const comma = '{\n  "items": [{ "p": "prova",\n    "q": 1,5 }]\n}';
    expect(errorsOf(readSharedText(comma))).toContain('Riga 3: il numero «1,5» è scritto con la virgola: usa il punto (1.5)');
  });

  it('blocco ```json e testo prima e dopo: ripuliti, il piano si importa', async () => {
    const json = JSON.stringify(filledTemplate(), null, 2);
    const chat = `Ecco il tuo piano compilato:\n\n\`\`\`json\n${json}\n\`\`\`\n\nNella dieta mancavano i valori nutrizionali.`;
    const fromFile = ok(await readSharedFile(fakeFile(chat).file));
    expect(fromFile.kind === 'diet' && fromFile.imp.file.title).toBe('Prova compilata');
    const fromPaste = ok(readSharedText(chat));
    expect(fromPaste.kind === 'diet' && fromPaste.imp.file.title).toBe('Prova compilata');
    const plain = ok(readSharedText(`Ecco il file: ${JSON.stringify(filledTemplate())} Fammi sapere!`));
    expect(plain.kind).toBe('diet');
  });
});

describe('fixture "come se l’avesse compilata Claude": import completo', () => {
  beforeEach(resetDb);

  it('file → anteprima → salvataggio → esportazione e link con le indicazioni generali', async () => {
    const shared = ok(await readSharedFile(fakeFile(fixtureText()).file));
    if (shared.kind !== 'diet') throw new Error('mi aspettavo una dieta');
    const { imp } = shared;
    expect(imp.origin).toBe('file');
    expect(imp.file.id).toMatch(/^[0-9a-f-]{36}$/);

    const plan = await saveImportedPlan(imp.file, imp.origin, 'new', TODAY);
    expect(plan.active).toBe(true);
    expect(plan.title).toBe('Piano di prova Claude');
    expect(plan.payload.generalNotes).toBe(imp.file.generalNotes);
    expect(planCompleteness(plan.payload).untypedDays).toEqual([2]);

    const exported = planToDietFile(plan);
    expect(exported.generalNotes).toBe(plan.payload.generalNotes);
    const reimported = ok(await readSharedFile(fakeFile(JSON.stringify(exported)).file));
    expect(reimported.kind === 'diet' && reimported.imp.file).toEqual(exported);
  });

  it('le indicazioni generali viaggiano anche nel link compatto', () => {
    const file = { ...smallDietFile(), generalNotes: 'Indicazioni di prova per tutti i giorni.' };
    const { payload } = encodeShare(compactForLink(file, dietFileSchema), BASE);
    const back = ok(readSharedPayload(payload));
    expect(back.kind === 'diet' && back.imp.file).toEqual(file);
  });
});
