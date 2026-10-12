import { MAX_TEXT } from '../data/limits';
import { measurementSchema, type Measurement } from '../data/schemas/measurements';
import { formatDecimal } from '../diet/format';
import { checkMeasurement, type MeasurementValues, type ValueField } from './consistency';
import { numericDate } from './format';
import { numberToField, parseDecimalInput } from './number';

/** Modulo "Nuova misura" / modifica (SPEC § 5.6): campi di testo → misura validata, errori per campo. */

export interface FieldDef {
  key: ValueField;
  label: string;
  unit: string;
  /** Solo interi (kcal). */
  integer?: boolean;
}

export interface FieldGroup {
  id: 'base' | 'composition' | 'water' | 'bia' | 'circ';
  title: string;
  fields: readonly FieldDef[];
}

export const FORM_GROUPS: readonly FieldGroup[] = [
  { id: 'base', title: 'Peso e data', fields: [{ key: 'weightKg', label: 'Peso', unit: 'kg' }] },
  {
    id: 'composition',
    title: 'Composizione',
    fields: [
      { key: 'fmKg', label: 'Massa grassa FM', unit: 'kg' },
      { key: 'fmPct', label: 'Massa grassa FM', unit: '%' },
      { key: 'ffmKg', label: 'Massa magra FFM', unit: 'kg' },
      { key: 'bcmKg', label: 'Massa cellulare BCM', unit: 'kg' },
    ],
  },
  {
    id: 'water',
    title: 'Acqua',
    fields: [
      { key: 'tbwL', label: 'Acqua totale TBW', unit: 'L' },
      { key: 'ecwL', label: 'Acqua extracellulare ECW', unit: 'L' },
    ],
  },
  {
    id: 'bia',
    title: 'Bioimpedenza',
    fields: [
      { key: 'phaDeg', label: 'Angolo di fase PhA', unit: '°' },
      { key: 'bmrKcal', label: 'Metabolismo basale BMR', unit: 'kcal', integer: true },
    ],
  },
  {
    id: 'circ',
    title: 'Circonferenze',
    fields: [
      { key: 'chestCm', label: 'Torace', unit: 'cm' },
      { key: 'waistCm', label: 'Vita', unit: 'cm' },
      { key: 'abdomenCm', label: 'Addome', unit: 'cm' },
      { key: 'hipsCm', label: 'Fianchi', unit: 'cm' },
      { key: 'thighCm', label: 'Coscia', unit: 'cm' },
      { key: 'armCm', label: 'Braccio', unit: 'cm' },
      { key: 'calfCm', label: 'Polpaccio', unit: 'cm' },
    ],
  },
];

export const VALUE_FIELDS: readonly FieldDef[] = FORM_GROUPS.flatMap((g) => g.fields);

export interface MeasurementForm {
  date: string;
  notes: string;
  values: Record<ValueField, string>;
}

export type FormErrorKey = ValueField | 'date' | 'values' | 'notes';

export interface FormResult {
  /** Misura pronta da salvare (senza id), solo se non ci sono errori. */
  value: Omit<Measurement, 'id'> | null;
  errors: Partial<Record<FormErrorKey, string>>;
  warnings: string[];
}

export function emptyForm(date: string): MeasurementForm {
  const values = Object.fromEntries(VALUE_FIELDS.map((f) => [f.key, ''])) as Record<ValueField, string>;
  return { date, notes: '', values };
}

export function formFromMeasurement(m: Measurement): MeasurementForm {
  const values = Object.fromEntries(VALUE_FIELDS.map((f) => [f.key, numberToField(m[f.key])])) as Record<ValueField, string>;
  return { date: m.date, notes: m.notes, values };
}

/** Massimo ammesso dallo schema per un campo (es. peso 400). */
export function maxOf(key: ValueField): number | null {
  const field = measurementSchema.shape[key];
  return field.unwrap().maxValue ?? null;
}

export interface FormContext {
  today: string;
  /** Misure già salvate (per le date doppie). */
  existing: readonly Pick<Measurement, 'id' | 'date'>[];
  /** Id della misura in modifica (`null` = nuova). */
  id: string | null;
}

export function readMeasurementForm(form: MeasurementForm, ctx: FormContext): FormResult {
  const errors: FormResult['errors'] = {};
  const values = {} as MeasurementValues;

  for (const field of VALUE_FIELDS) {
    const parsed = parseDecimalInput(form.values[field.key], { integer: field.integer });
    if (!parsed.ok) {
      errors[field.key] = parsed.error;
      values[field.key] = null;
      continue;
    }
    const max = maxOf(field.key);
    if (parsed.value !== null && max !== null && parsed.value > max) {
      errors[field.key] = `Valore troppo alto: al massimo ${formatDecimal(max, 0)}${field.unit === '°' ? '°' : ` ${field.unit}`}.`;
    }
    values[field.key] = parsed.value;
  }

  const date = form.date.trim();
  if (date === '' || !measurementSchema.shape.date.safeParse(date).success) {
    errors.date = 'Inserisci la data della misura.';
  } else if (date > ctx.today) {
    errors.date = 'La data è nel futuro.';
  } else if (ctx.existing.some((m) => m.date === date && m.id !== ctx.id)) {
    errors.date = `Esiste già una misura del ${numericDate(date)}: modificala dallo storico.`;
  }

  const notes = form.notes.trim();
  if (notes.length > MAX_TEXT.note) errors.notes = `Al massimo ${formatDecimal(MAX_TEXT.note, 0)} caratteri.`;

  // Un campo scritto male conta come "scritto": l'errore giusto è il suo, non "almeno un valore".
  const typed = VALUE_FIELDS.some((f) => form.values[f.key].trim() !== '');
  if (!typed) errors.values = 'Inserisci almeno un valore.';

  const report = checkMeasurement(values);
  for (const e of report.errors) errors[e.field] ??= e.message;

  const ok = Object.keys(errors).length === 0;
  return { value: ok ? { date, notes, ...values } : null, errors, warnings: report.warnings };
}

/** Misura precedente a una data (per i suggerimenti); per una misura nuova, l'ultima. */
export function previousMeasurement<T extends Pick<Measurement, 'id' | 'date'>>(
  list: readonly T[],
  date: string | null,
  excludeId: string | null,
): T | undefined {
  let best: T | undefined;
  for (const m of list) {
    if (m.id === excludeId) continue;
    if (date !== null && m.date >= date) continue;
    if (!best || m.date > best.date) best = m;
  }
  return best;
}

/** Suggerimento nel campo (placeholder, mai salvato): "ultima: 76,4". */
export function suggestion(previous: Measurement | undefined, key: ValueField): string {
  const value = previous?.[key];
  return value === null || value === undefined ? '' : `ultima: ${numberToField(value)}`;
}
