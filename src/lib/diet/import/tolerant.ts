import { lookup } from '../../data/errors';
import { weekdayName } from '../../data/schemas/diet-payload';
import { EMPTY_TEMPLATE_MESSAGE, isEmptyTemplate } from '../template/template';
import { dietDayV2ToV3 } from '../../data/migrations/diet-v3';

/**
 * Piano esteso nato dal modello per Claude: prima di zod si completano solo i "vuoti" previsti dal modello
 * (id, versione, titolo; `""` e blocchi tutti `null` = dato mancante, mai zero). Tutto il resto passa
 * invariato a zod, che lo segnala: niente valori indovinati. Lavora su una copia, non lancia mai.
 */

export interface NormalizeOptions {
  today: Date;
  newId: () => string;
}

export interface NormalizedDiet {
  raw: Record<string, unknown>;
  /** Cose da sapere, l'import resta possibile (finiscono nell'anteprima). */
  warnings: string[];
  /** Cose da correggere nel file: l'import si ferma. */
  errors: string[];
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/** `""` (anche solo spazi) → `null`; il resto com'è. */
function blankToNull(record: Json, key: string): void {
  if (typeof record[key] === 'string' && (record[key] as string).trim() === '') record[key] = null;
}

const NUTRIENT_NAMES: Readonly<Record<string, string>> = {
  kcal: 'kcal',
  protein: 'proteine',
  carbs: 'carboidrati',
  fat: 'grassi',
  fiber: 'fibre',
};

/**
 * Blocco di numeri facoltativo (`per100`, `targets`): tutti mancanti → `null` (lo chiede il completamento guidato);
 * alcuni sì e altri no → errore, con i nomi di quelli obbligatori che mancano.
 * Restituisce i campi obbligatori mancanti (vuoto se il blocco va bene).
 */
function normalizeNumbers(owner: Json, key: string, fields: readonly string[], required: readonly string[]): string[] {
  const block = owner[key];
  if (!isRecord(block)) {
    if (typeof block === 'string' && block.trim() === '') owner[key] = null;
    return [];
  }
  for (const field of fields) blankToNull(block, field);
  if (fields.every((field) => block[field] === undefined || block[field] === null)) {
    owner[key] = null;
    return [];
  }
  return required.filter((field) => block[field] === undefined || block[field] === null);
}

function namesList(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dayLabel(day: Json, index: number): string {
  return typeof day.weekday === 'number' && day.weekday >= 1 && day.weekday <= 7 ? weekdayName(day.weekday) : `Giorno n. ${index + 1}`;
}

export function normalizeExtendedDiet(input: Json, options: NormalizeOptions): NormalizedDiet {
  if (isEmptyTemplate(input)) return { raw: input, warnings: [], errors: [EMPTY_TEMPLATE_MESSAGE] };

  const raw = structuredClone(input);
  const warnings: string[] = [];
  const errors: string[] = [];

  // Campi del modello (`_modello`, `_generato`, `_istruzioni`, `_esempio`): ignorati se rimasti.
  for (const key of Object.keys(raw)) if (key.startsWith('_')) delete raw[key];

  if (isBlank(raw.id)) raw.id = options.newId();
  if (raw.version === undefined || raw.version === null) raw.version = 1;
  if (isBlank(raw.title)) raw.title = `Piano del ${shortDate(options.today)}`;
  blankToNull(raw, 'validFrom');

  if (isRecord(raw.products)) {
    for (const [key, product] of Object.entries(raw.products)) {
      if (!isRecord(product)) continue;
      blankToNull(product, 'pieceGrams');
      const missing = normalizeNumbers(product, 'per100', ['kcal', 'protein', 'carbs', 'fat', 'fiber'], ['kcal', 'protein', 'carbs', 'fat']);
      if (missing.length > 0) {
        const name = typeof product.name === 'string' && product.name.trim() !== '' ? product.name.trim() : key;
        const names = namesList(missing.map((field) => lookup(NUTRIENT_NAMES, field) ?? field));
        errors.push(`${name}: valori per 100 g incompleti (mancano ${names}): completali o lasciali tutti null`);
      }
    }
  }

  if (Array.isArray(raw.days)) {
    // Un giorno ancora nella forma v2 (`type` e `meals`, senza `variants`) diventa una variante sola.
    const days: unknown[] = raw.days.map((day: unknown) => (isRecord(day) && !('variants' in day) && 'meals' in day ? dietDayV2ToV3(day) : day));
    raw.days = days;
    days.forEach((day: unknown, index) => {
      if (!isRecord(day)) return;
      // Tipo vuoto = mancante: lo si sceglie nel completamento guidato.
      blankToNull(day, 'defaultType');
      if (day.defaultType === undefined) day.defaultType = null;
      if (!Array.isArray(day.variants)) return;
      for (const variant of day.variants) if (isRecord(variant)) blankToNull(variant, 'type');
      // Una sola variante: il suo tipo e quello predefinito sono lo stesso (se uno manca si prende l'altro).
      const only = day.variants.length === 1 && isRecord(day.variants[0]) ? (day.variants[0] as Json) : null;
      if (only) {
        if ((only.type === undefined || only.type === null) && typeof day.defaultType === 'string') only.type = day.defaultType;
        else if (day.defaultType === null && typeof only.type === 'string') day.defaultType = only.type;
      }
      for (const variant of day.variants) {
        if (!isRecord(variant) || !Array.isArray(variant.meals)) continue;
        normalizeMeals(variant.meals, day, index, warnings);
      }
    });

    // Meno di 7 giorni: si importa lo stesso, ma lo si dice.
    const present = new Set(days.flatMap((day: unknown) => (isRecord(day) && typeof day.weekday === 'number' ? [day.weekday] : [])));
    const missingDays = [1, 2, 3, 4, 5, 6, 7].filter((n) => !present.has(n)).map((n) => weekdayName(n).toLowerCase());
    if (days.length > 0 && days.length < 7 && missingDays.length > 0) {
      warnings.push(
        missingDays.length === 1
          ? `Manca ${missingDays[0]}: quel giorno il piano sarà vuoto`
          : `Mancano ${namesList(missingDays)}: in quei giorni il piano sarà vuoto`,
      );
    }
  }

  if (isRecord(raw.dayTypes)) {
    const days: unknown[] = Array.isArray(raw.days) ? raw.days : [];
    const used = new Set(
      days.flatMap((day) => {
        if (!isRecord(day)) return [];
        const types = Array.isArray(day.variants) ? day.variants.flatMap((v) => (isRecord(v) && typeof v.type === 'string' ? [v.type] : [])) : [];
        return typeof day.defaultType === 'string' ? [...types, day.defaultType] : types;
      }),
    );
    for (const [key, dayType] of Object.entries(raw.dayTypes)) {
      if (!isRecord(dayType)) continue;
      const missing = normalizeNumbers(dayType, 'targets', ['kcal', 'protein', 'carbs', 'fat', 'fiber'], ['kcal']);
      // Tipi che nessun giorno usa: ignorati. Si tolgono solo se vuoti (i segnaposto del modello):
      // con i target del nutrizionista restano, servono quando il tipo si assegna nel completamento guidato.
      if (!used.has(key) && dayType.targets === null) {
        delete raw.dayTypes[key];
        continue;
      }
      if (missing.length > 0) {
        const label = typeof dayType.label === 'string' && dayType.label.trim() !== '' ? dayType.label.trim() : key;
        errors.push(`${label}: target senza kcal: aggiungi le kcal o lascia tutti i target a null`);
      }
    }
  }

  return { raw, warnings, errors };
}

/** Pasti di una variante: `""` = mancante per orario e ricetta, fascia oraria con un solo estremo ignorata con avviso. */
function normalizeMeals(meals: unknown[], day: Json, index: number, warnings: string[]): void {
  for (const meal of meals) {
    if (!isRecord(meal)) continue;
    blankToNull(meal, 'time');
    blankToNull(meal, 'recipe');
    const window = meal.window;
    if (typeof window === 'string' && window.trim() === '') meal.window = null;
    if (Array.isArray(window) && window.every((end) => isBlank(end) || typeof end === 'string')) {
      const blanks = window.filter(isBlank).length;
      if (window.length === 0 || blanks === window.length) meal.window = null;
      else if (blanks > 0) {
        meal.window = null;
        const label = typeof meal.label === 'string' && meal.label.trim() !== '' ? meal.label.trim() : String(meal.key ?? 'pasto');
        warnings.push(`${dayLabel(day, index)} › ${label}: fascia oraria incompleta, ignorata`);
      }
    }
  }
}
