import { z } from 'zod';
import { MAX_ERROR_MESSAGES } from './limits';

/** Esito di una validazione: il valore pulito oppure messaggi in italiano (mai stack trace). */
export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/**
 * Errore con messaggi già pronti per l'utente (validazione fallita in scrittura, file non valido…).
 * Non chiamarlo "DataError": è il nome di un errore di IndexedDB e Dexie lo convertirebbe nel suo,
 * perdendo i messaggi, quando viene lanciato dentro una transazione.
 */
export class ValidationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(errors.join('\n'));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Voce di un dizionario, solo se è sua: `dict['constructor']` restituirebbe la funzione `Object`
 * ereditata dal prototipo (le chiavi arrivano da file esterni).
 */
export function lookup<V>(dict: Readonly<Record<string, V>>, key: string): V | undefined {
  return Object.hasOwn(dict, key) ? dict[key] : undefined;
}

/** Nomi italiani dei campi, per i percorsi dei messaggi ("esercizi › n. 3 › kg"). */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  app: 'app',
  kind: 'tipo di file',
  schemaVersion: 'versione del formato',
  createdAt: 'data di creazione',
  counts: 'conteggi',
  tables: 'tabelle',
  id: 'id',
  version: 'versione',
  author: 'autore',
  source: 'origine',
  name: 'nome',
  title: 'titolo',
  weekdays: 'giorni',
  weekday: 'giorno',
  intro: 'introduzione',
  warmup: 'riscaldamento',
  hint: 'suggerimento',
  dose: 'dose',
  items: 'elementi',
  exerciseId: 'esercizio',
  muscles: 'muscoli',
  sets: 'serie',
  setsDetail: 'serie diverse',
  reps: 'ripetizioni',
  kg: 'kg',
  restSec: 'recupero',
  note: 'nota',
  notes: 'note',
  videoUrl: 'link video',
  cardio: 'cardio',
  cardioDone: 'cardio fatto',
  type: 'tipo',
  minutes: 'minuti',
  distanceKm: 'distanza',
  updatedAt: 'ultima modifica',
  workoutId: 'scheda',
  workoutVersion: 'versione della scheda',
  workoutName: 'nome della scheda',
  startedAt: 'inizio',
  endedAt: 'fine',
  readiness: 'readiness',
  sleep: 'sonno',
  mood: 'umore',
  energy: 'energia',
  stress: 'stress',
  soreness: 'affaticamento',
  itemIndex: 'posizione esercizio',
  setIndex: 'numero serie',
  done: 'fatto',
  userNotes: 'note per il PT',
  text: 'testo',
  rpe: 'RPE',
  snapshot: 'copia della scheda',
  live: 'sessione in corso',
  rest: 'recupero',
  totalSec: 'durata del recupero',
  endsAt: 'fine del recupero',
  pausedRemainingMs: 'recupero in pausa',
  exportedAt: 'data di esportazione',
  session: 'sessione',
  date: 'data',
  validFrom: 'valido dal',
  active: 'attivo',
  archived: 'archiviato',
  importedAt: 'data di importazione',
  origin: 'provenienza',
  payload: 'piano',
  dayTypes: 'tipi di giornata',
  label: 'etichetta',
  targets: 'target',
  targetsSource: 'origine dei target',
  kcal: 'kcal',
  protein: 'proteine',
  carbs: 'carboidrati',
  fat: 'grassi',
  fiber: 'fibre',
  categories: 'categorie',
  products: 'prodotti',
  cat: 'categoria',
  unit: 'unità',
  shop: 'in lista spesa',
  per100: 'valori per 100 g',
  pieceGrams: 'grammi per pezzo',
  days: 'giorni',
  supplements: 'integratori',
  when: 'quando',
  skip: 'non serve',
  meals: 'pasti',
  key: 'chiave',
  time: 'orario',
  window: 'finestra',
  recipe: 'ricetta',
  p: 'prodotto',
  q: 'quantità',
  recipes: 'ricette',
  n: 'numero',
  meta: 'tempi e attrezzatura',
  steps: 'passaggi',
  tip: 'consiglio',
  planId: 'piano',
  swappedFromWeekday: 'giorno scambiato',
  eaten: 'mangiato',
  weekStart: 'inizio settimana',
  checked: 'spunte',
  value: 'valore',
  birthYear: 'anno di nascita',
  sex: 'sesso',
  heightCm: 'altezza',
  goal: 'obiettivo',
  equipment: 'attrezzatura',
  custom: 'personalizzato',
  weightKg: 'peso',
  // Profilo e misure (M7)
  activityLevel: 'livello di attività',
  fmKg: 'massa grassa (kg)',
  fmPct: 'massa grassa (%)',
  ffmKg: 'massa magra (kg)',
  bcmKg: 'massa cellulare (kg)',
  tbwL: 'acqua totale',
  ecwL: 'acqua extracellulare',
  phaDeg: 'angolo di fase',
  bmrKcal: 'metabolismo basale',
  chestCm: 'torace',
  waistCm: 'vita',
  abdomenCm: 'addome',
  hipsCm: 'fianchi',
  thighCm: 'coscia',
  armCm: 'braccio',
  calfCm: 'polpaccio',
  // Editor schede (M4)
  lastSource: 'origine predefinita',
  savedAt: 'salvata il',
  draft: 'bozza',
  baseVersion: 'versione di partenza',
  setsDetailMemory: 'serie diverse (memoria)',
  // File di MyDiet (§ 8.3)
  esportato: 'data di esportazione',
  dieta: 'dieta',
  categorie: 'categorie',
  prodotti: 'prodotti',
  nome: 'nome',
  unita: 'unità',
  spesa: 'in lista spesa',
  giorni: 'giorni',
  nota: 'nota',
  pasti: 'pasti',
  abilita: 'inizio finestra',
  fine: 'fine finestra',
  colazione: 'colazione',
  spuntino1: 'spuntino del mattino',
  pranzo: 'pranzo',
  spuntino2: 'spuntino del pomeriggio',
  cena: 'cena',
  // Tabelle del backup
  profile: 'profilo',
  measurements: 'misurazioni',
  exercises: 'esercizi',
  workouts: 'schede',
  sessions: 'sessioni',
  dietPlans: 'piani alimentari',
  dietLog: 'diario dieta',
  shopping: 'spesa',
  settings: 'impostazioni',
};

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((part) => {
      if (typeof part === 'number') return `n. ${part + 1}`;
      const key = String(part);
      return lookup(FIELD_LABELS, key) ?? `«${key}»`;
    })
    .join(' › ');
}

const TYPE_NAMES: Readonly<Record<string, string>> = {
  string: 'un testo',
  number: 'un numero',
  int: 'un numero intero',
  boolean: 'vero o falso',
  array: 'un elenco',
  object: 'un oggetto',
  record: 'un oggetto',
  null: 'vuoto (null)',
};

function describeValue(input: unknown): string {
  if (input === null) return 'vuoto (null)';
  if (Array.isArray(input)) return 'un elenco';
  switch (typeof input) {
    case 'string':
      return 'un testo';
    case 'number':
      return Number.isInteger(input) ? 'un numero intero' : 'un numero con decimali';
    case 'boolean':
      return 'vero o falso';
    case 'object':
      return 'un oggetto';
    default:
      return 'un valore di tipo diverso';
  }
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? `«${value}»` : String(value);
}

const FORMAT_MESSAGES: Readonly<Record<string, string>> = {
  date: 'data non valida: usa il formato AAAA-MM-GG',
  datetime: 'data e ora non valide (formato ISO, es. 2026-10-11T08:30:00.000Z)',
  url: 'indirizzo web non valido: deve iniziare con https://',
  uuid: 'identificativo non valido',
  regex: 'formato non valido',
};

const DECIMAL_COMMA = /^-?\d+,\d+$/;

/** Mappa degli errori di zod in italiano semplice. I messaggi scritti negli schemi hanno la precedenza. */
export const italianErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined) return 'campo obbligatorio mancante';
      // Errore tipico dei file scritti a mano o in chat: "1,5" invece di 1.5.
      if (issue.expected === 'number' && typeof issue.input === 'string' && DECIMAL_COMMA.test(issue.input.trim())) {
        return `numero scritto con la virgola («${issue.input.trim()}»): usa il punto (${issue.input.trim().replace(',', '.')}), senza virgolette`;
      }
      return `atteso ${lookup(TYPE_NAMES, issue.expected) ?? issue.expected}, trovato ${describeValue(issue.input)}`;
    case 'too_big': {
      const max = Number(issue.maximum);
      if (issue.origin === 'string') return `testo troppo lungo: massimo ${max} caratteri`;
      if (issue.origin === 'array' || issue.origin === 'set') return `troppi elementi: massimo ${max}`;
      if (issue.origin === 'file') return `file troppo grande`;
      return issue.inclusive === false ? `deve essere minore di ${max}` : `valore troppo alto: massimo ${max}`;
    }
    case 'too_small': {
      const min = Number(issue.minimum);
      if (issue.origin === 'string') return min <= 1 ? 'non può essere vuoto' : `testo troppo corto: minimo ${min} caratteri`;
      if (issue.origin === 'array' || issue.origin === 'set') {
        if (issue.exact) return `servono esattamente ${min} elementi`;
        return min <= 1 ? 'elenco vuoto: serve almeno un elemento' : `servono almeno ${min} elementi`;
      }
      return issue.inclusive === false ? `deve essere maggiore di ${min}` : `valore troppo basso: minimo ${min}`;
    }
    case 'invalid_value':
      if (issue.values.length === 1) return `atteso ${formatValue(issue.values[0])}`;
      return `valore non ammesso: scegli tra ${issue.values.map(formatValue).join(', ')}`;
    case 'invalid_format':
      return lookup(FORMAT_MESSAGES, issue.format) ?? 'formato non valido';
    case 'not_multiple_of':
      return `deve essere un multiplo di ${String(issue.divisor)}`;
    case 'unrecognized_keys':
      return `campi non previsti: ${issue.keys.join(', ')}`;
    case 'invalid_key':
      return 'nome di chiave non valido';
    case 'invalid_union':
      return 'valore non valido';
    case 'invalid_element':
      return 'elemento non valido';
    default:
      return 'valore non valido';
  }
};

/** Messaggi leggibili ("campo › motivo"), senza doppioni, al massimo `MAX_ERROR_MESSAGES` + riepilogo. */
export function formatIssues(issues: readonly z.core.$ZodIssue[]): string[] {
  const lines = [
    ...new Set(
      issues.flatMap((issue) => {
        // Errore sul nome di una chiave: il motivo vero è nell'errore annidato.
        if (issue.code === 'invalid_key' && issue.issues.length > 0) {
          return issue.issues.map((inner) => line([...issue.path], inner.message));
        }
        return [line(issue.path, issue.message)];
      }),
    ),
  ];
  if (lines.length <= MAX_ERROR_MESSAGES) return lines;
  const hidden = lines.length - MAX_ERROR_MESSAGES;
  return [...lines.slice(0, MAX_ERROR_MESSAGES), `… e ${hidden === 1 ? 'un altro errore' : `altri ${hidden} errori`}`];
}

function line(path: readonly PropertyKey[], message: string): string {
  const where = formatPath(path);
  return where ? `${where}: ${message}` : message.charAt(0).toUpperCase() + message.slice(1);
}

/** Valida con messaggi italiani. Non lancia mai. */
export function validate<S extends z.ZodType>(schema: S, data: unknown): Result<z.output<S>> {
  const parsed = schema.safeParse(data, { error: italianErrorMap });
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: formatIssues(parsed.error.issues) };
}

/** Come `validate`, ma lancia `ValidationError`: per le scritture nel database. */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = validate(schema, data);
  if (!result.ok) throw new ValidationError(result.errors);
  return result.value;
}
