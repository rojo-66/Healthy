// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatIssues, validate, type Result } from '../../../src/lib/data/errors';
import { parseDietFile, parseWorkoutFile } from '../../../src/lib/data/read-file';
import { TABLE_SCHEMAS } from '../../../src/lib/data/schemas';
import { dietPayloadSchema } from '../../../src/lib/data/schemas/diet-payload';
import { measurementSchema } from '../../../src/lib/data/schemas/measurements';
import { sessionSchema } from '../../../src/lib/data/schemas/sessions';
import { shoppingSchema } from '../../../src/lib/data/schemas/shopping';
import dietFixture from '../../fixtures/diet.json';
import hugeText from '../../fixtures/invalid/huge-text.json';
import missingField from '../../fixtures/invalid/missing-field.json';
import wrongType from '../../fixtures/invalid/wrong-type.json';
import measurementsFixture from '../../fixtures/measurements.json';
import sessionFixture from '../../fixtures/session.json';
import workoutFixture from '../../fixtures/workout.json';
import { clone, validBackupJson } from './helpers';

function errorsOf(result: Result<unknown>): string[] {
  if (result.ok) throw new Error('Mi aspettavo un errore di validazione');
  return result.errors;
}

/** Piano di prova modificabile (i tipi dedotti dal JSON sono troppo stretti per i test). */
interface EditableDiet {
  products: Record<string, unknown>;
  days: {
    weekday: number;
    type: string | null;
    meals: { recipe?: number | null; time?: string | null; items: { p: string; q: number }[] }[];
  }[];
}

function editableDiet(): EditableDiet {
  return clone(dietFixture) as unknown as EditableDiet;
}

/** Nessun dettaglio tecnico nei messaggi per l'utente. */
function expectReadable(errors: readonly string[]) {
  expect(errors.length).toBeGreaterThan(0);
  for (const message of errors) {
    expect(message).not.toMatch(/ZodError|Error:|\bat \w+ \(|undefined|\[object/);
  }
}

describe('file scheda (§ 8.1)', () => {
  it('la fixture è valida e i campi facoltativi prendono un valore neutro', () => {
    const result = parseWorkoutFile(workoutFixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(3);
    expect(result.value.warmup[1]).toEqual({ name: 'Cyclette', hint: '', dose: '' });
    expect(result.value.items[2]).toMatchObject({ muscles: [], note: '', videoUrl: null, setsDetail: null });
  });

  it('campo mancante → nome del campo e motivo', () => {
    const errors = errorsOf(parseWorkoutFile(missingField));
    expect(errors).toEqual(['nome: campo obbligatorio mancante']);
  });

  it('tipo sbagliato → percorso leggibile', () => {
    const errors = errorsOf(parseWorkoutFile(wrongType));
    expect(errors).toEqual(['elementi › n. 1 › kg: atteso un numero, trovato un testo']);
  });

  it('testo enorme → rifiutato con il limite', () => {
    const errors = errorsOf(parseWorkoutFile(hugeText));
    expect(errors).toEqual(['introduzione: testo troppo lungo: massimo 4000 caratteri']);
  });

  it('link video solo https', () => {
    for (const videoUrl of ['javascript:alert(1)', 'http://example.com/v', 'non è un link']) {
      const file = clone(workoutFixture);
      file.items[0]!.videoUrl = videoUrl;
      expect(errorsOf(parseWorkoutFile(file))).toEqual([
        'elementi › n. 1 › link video: indirizzo web non valido: deve iniziare con https://',
      ]);
    }
  });

  it('serie diverse: una per serie', () => {
    const file = clone(workoutFixture);
    file.items[1]!.sets = 4;
    expect(errorsOf(parseWorkoutFile(file))).toEqual([
      'elementi › n. 2 › serie diverse: servono 4 serie nel dettaglio, ce ne sono 3',
    ]);
  });

  it('busta: app, tipo e versione con messaggi mirati', () => {
    expect(errorsOf(parseWorkoutFile({ ...workoutFixture, app: 'altra' }))).toEqual([
      'Questo file non è stato creato da Healthy.',
    ]);
    expect(errorsOf(parseWorkoutFile(validBackupJson()))).toEqual(['Questo file è un backup, non una scheda.']);
    expect(errorsOf(parseWorkoutFile({ ...workoutFixture, schemaVersion: 2 }))[0]).toMatch(
      /versione più recente dell'app.*aggiorna Healthy/,
    );
    expect(errorsOf(parseWorkoutFile({ app: 'dieta-e-spesa', schemaVersion: 1 }))).toEqual([
      'È un file di MyDiet: si importa dalla sezione Dieta.',
    ]);
    expect(errorsOf(parseWorkoutFile([1, 2]))).toEqual(['Il file non contiene dati di Healthy.']);
    expect(errorsOf(parseWorkoutFile('ciao'))).toEqual(['Il file non contiene dati di Healthy.']);
  });

  it('i testi vengono ripuliti dagli spazi ai lati', () => {
    const result = parseWorkoutFile({ ...workoutFixture, name: '  Gambe  ' });
    expect(result.ok && result.value.name).toBe('Gambe');
  });
});

describe('file piano alimentare (§ 8.2)', () => {
  it('la fixture è valida, con pasti vuoti e categorie non elencate (come MyDiet)', () => {
    const result = parseDietFile(dietFixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const monday = result.value.days[0]!;
    expect(monday.meals[2]).toMatchObject({ name: '', items: [], time: null, window: null, recipe: null });
    expect(result.value.products.vitd).toMatchObject({ cat: 'Integratori', shop: false, per100: null });
    expect(result.value.categories).not.toContain('Integratori');
    expect(result.value.dayTypes.rest!.targets).toEqual({ kcal: 1600, protein: null, carbs: null, fat: null, fiber: null });
  });

  it('un pasto che usa un prodotto inesistente → messaggio con giorno e pasto', () => {
    const file = editableDiet();
    file.days[0]!.meals[1]!.items.push({ p: 'tofu', q: 100 });
    expect(errorsOf(parseDietFile(file))).toEqual([
      "Lunedì › Pranzo usa il prodotto «tofu» che non è nell'elenco dei prodotti",
    ]);
  });

  it('ricetta e tipo di giornata devono esistere; giorni e pasti non ripetuti', () => {
    const file = editableDiet();
    file.days[0]!.meals[1]!.recipe = 9;
    file.days[1]!.type = 'corsa';
    file.days[1]!.weekday = 1;
    expect(errorsOf(parseDietFile(file))).toEqual([
      'Lunedì › Pranzo: la ricetta 9 non è tra le ricette',
      'Lunedì compare due volte',
      'Lunedì: il tipo di giornata «corsa» non è tra i tipi di giornata',
    ]);
  });

  it('chiavi riservate rifiutate', () => {
    const file = editableDiet();
    file.products['constructor'] = { name: 'x', unit: 'g' };
    expect(errorsOf(parseDietFile(file))).toEqual(['prodotti › «constructor»: chiave riservata, non ammessa']);
  });

  it('__proto__ non inquina il prototipo (lo rifiuta anche la lettura del file, vedi read-file)', () => {
    const raw: unknown = JSON.parse(
      JSON.stringify(dietFixture).replace('"products":{', '"products":{"__proto__":{"name":"x","unit":"g"},'),
    );
    const result = parseDietFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.getPrototypeOf(result.value.products)).toBe(Object.prototype);
    expect(Object.keys(result.value.products)).not.toContain('__proto__');
    expect(({} as Record<string, unknown>).name).toBeUndefined();
  });

  it('chiavi con caratteri non ammessi', () => {
    const errors = errorsOf(validate(dietPayloadSchema, { products: { 'Pollo Arrosto': { name: 'x', unit: 'g' } }, days: [{ weekday: 1, meals: [] }] }));
    expect(errors).toEqual(['prodotti › «Pollo Arrosto»: chiave non valida: usa minuscole, numeri, - e _ (massimo 40)']);
  });

  it('orari e finestre in formato HH:MM', () => {
    const file = editableDiet();
    file.days[0]!.meals[0]!.time = '7.30';
    expect(errorsOf(parseDietFile(file))).toEqual(['giorni › n. 1 › pasti › n. 1 › orario: orario non valido: usa il formato HH:MM']);
  });
});

describe('righe delle tabelle', () => {
  it('sessione e misurazioni di prova valide', () => {
    expect(validate(sessionSchema, sessionFixture).ok).toBe(true);
    for (const m of measurementsFixture) expect(validate(measurementSchema, m).ok).toBe(true);
  });

  it('ogni riga del backup di prova rispetta lo schema della sua tabella', () => {
    const backup = validBackupJson() as { tables: Record<keyof typeof TABLE_SCHEMAS, unknown[]> };
    for (const [table, schema] of Object.entries(TABLE_SCHEMAS)) {
      for (const row of backup.tables[table as keyof typeof TABLE_SCHEMAS]) {
        expect(validate(schema, row).ok, table).toBe(true);
      }
    }
  });

  it('valori fuori dai limiti e date impossibili', () => {
    const session = { ...clone(sessionFixture), rpe: 11, startedAt: '2026-02-30T10:00:00.000Z' };
    const errors = errorsOf(validate(sessionSchema, session));
    expect(errors).toEqual([
      'inizio: data e ora non valide (formato ISO, es. 2026-10-11T08:30:00.000Z)',
      'RPE: valore troppo alto: massimo 10',
    ]);
    expect(errorsOf(validate(measurementSchema, { ...measurementsFixture[0], date: '2026-13-01' }))).toEqual([
      'data: data non valida: usa il formato AAAA-MM-GG',
    ]);
  });

  it('la fine della sessione non può precedere l’inizio', () => {
    const session = { ...clone(sessionFixture), endedAt: '2026-10-05T15:00:00.000Z' };
    expect(errorsOf(validate(sessionSchema, session))).toEqual(['fine: la fine è prima dell’inizio']);
  });

  it('la spesa parte di lunedì', () => {
    expect(validate(shoppingSchema, { weekStart: '2026-10-05', checked: {} }).ok).toBe(true);
    expect(errorsOf(validate(shoppingSchema, { weekStart: '2026-10-07', checked: {} }))).toEqual([
      'inizio settimana: deve essere un lunedì',
    ]);
  });

  it('enum: elenco dei valori ammessi', () => {
    const errors = errorsOf(validate(TABLE_SCHEMAS.profile, { id: 'me', name: '', birthYear: null, sex: 'X', heightCm: null, goal: null }));
    expect(errors).toEqual(['sesso: valore non ammesso: scegli tra «M», «F»']);
  });
});

describe('formatIssues', () => {
  it('al massimo 10 messaggi, poi un riepilogo', () => {
    const schema = z.object({ values: z.array(z.number()) });
    const parsed = schema.safeParse({ values: Array.from({ length: 25 }, (_, i) => `x${i}`) });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const lines = formatIssues(parsed.error.issues);
    expect(lines).toHaveLength(11);
    expect(lines[10]).toBe('… e altri 15 errori');
  });

  it('messaggi sempre leggibili', () => {
    const results: Result<unknown>[] = [
      parseWorkoutFile(missingField),
      parseWorkoutFile(wrongType),
      parseWorkoutFile(hugeText),
      parseWorkoutFile({ app: 'healthy-app', kind: 'workout', schemaVersion: 1 }),
      validate(sessionSchema, {}),
    ];
    for (const result of results) expectReadable(errorsOf(result));
  });
});
