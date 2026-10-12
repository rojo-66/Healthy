import type { CompareRow, Comparison } from './compare';
import type { DeltaTone } from './direction';
import { dayMonth, deltaPctText, deltaSpoken, deltaText, metricText, metricWithUnit } from './format';
import { CIRCUMFERENCES, METRICS, type MetricKey, type Origin } from './metrics';

/** Cosa mostra la schermata Profilo per un confronto: testi pronti, nessun calcolo nei componenti. */

export interface ValuePart {
  text: string;
  origin: Origin;
}

export interface DeltaView {
  text: string;
  tone: DeltaTone;
  /** Per lo screen reader: "calo di 1,1 kg". */
  spoken: string;
}

/** Etichetta dell'origine accanto a un valore non misurato. */
export const ORIGIN_TAG: Readonly<Record<Origin, string>> = { measured: '', calculated: 'calc.', estimated: 'stimato' };
export const ORIGIN_SPOKEN: Readonly<Record<Origin, string>> = {
  measured: '',
  calculated: 'calcolato',
  estimated: 'stimato',
};

function delta(row: CompareRow, opts: { unit?: boolean; pct?: boolean } = {}): DeltaView | null {
  if (row.delta === null) return null;
  const { unit = true, pct = false } = opts;
  let text = deltaText(row.key, row.delta, unit);
  if (pct && !METRICS[row.key].percent && row.deltaPct !== null && row.delta !== 0) text += ` · ${deltaPctText(row.deltaPct)}`;
  return { text, tone: row.tone, spoken: deltaSpoken(row.key, row.delta) };
}

// --- Card in alto: Peso, BMI, BMR, Angolo di fase ---

export interface HeroView {
  key: MetricKey;
  label: string;
  value: string;
  unit: string;
  /** Valore stimato (solo il BMR): etichetta STIMATO. */
  estimated: boolean;
  /** Riga sotto il valore quando non c'è variazione (es. "serve l'altezza"). */
  note: string;
  delta: DeltaView | null;
}

export function heroCards(cmp: Comparison, hasHeight: boolean): HeroView[] {
  const card = (key: MetricKey, label: string, unit: string, note = ''): HeroView => {
    const row = cmp[key];
    return {
      key,
      label,
      value: metricText(key, row.now?.value),
      unit,
      estimated: row.now?.origin === 'estimated',
      note: row.now ? '' : note,
      delta: delta(row, { unit: false, pct: true }),
    };
  };
  return [
    card('weight', 'PESO', 'kg'),
    card('bmi', 'BMI', 'kg/m²', hasHeight ? '' : "serve l'altezza"),
    card('bmr', 'BMR', 'kcal'),
    card('pha', 'ANGOLO DI FASE', '°'),
  ];
}

// --- Righe di Composizione e Acqua ---

export interface RowView {
  key: MetricKey;
  label: string;
  /** Valore attuale in una o due parti ("14,9 kg", "19,6 %"); vuoto = mancante ("—"). */
  now: ValuePart[];
  /** "il 14/08: 16,0 kg · 21,3 %"; `null` senza misura precedente. */
  before: string | null;
  delta: DeltaView | null;
}

function parts(cmp: Comparison, keys: readonly MetricKey[]): ValuePart[] {
  return keys.flatMap((k) => {
    const v = cmp[k].now;
    return v ? [{ text: metricWithUnit(k, v.value), origin: v.origin }] : [];
  });
}

function beforeText(cmp: Comparison, keys: readonly MetricKey[], beforeDate: string | null): string | null {
  if (beforeDate === null) return null;
  const values = keys.flatMap((k) => {
    const v = cmp[k].before;
    return v ? [metricWithUnit(k, v.value)] : [];
  });
  return `il ${dayMonth(beforeDate)}: ${values.length > 0 ? values.join(' · ') : '—'}`;
}

function row(cmp: Comparison, key: MetricKey, label: string, extra: readonly MetricKey[], beforeDate: string | null): RowView {
  const keys = [key, ...extra];
  return {
    key,
    label,
    now: parts(cmp, keys),
    before: beforeText(cmp, keys, beforeDate),
    delta: delta(cmp[key], { pct: true }),
  };
}

export function compositionRows(cmp: Comparison, beforeDate: string | null): RowView[] {
  return [
    row(cmp, 'fmKg', 'Massa grassa FM', ['fmPct'], beforeDate),
    row(cmp, 'ffmKg', 'Massa magra FFM', ['ffmPct'], beforeDate),
    row(cmp, 'bcmKg', 'Massa cellulare BCM (% su FFM)', ['bcmPct'], beforeDate),
    row(cmp, 'bcmi', 'BCMI', [], beforeDate),
  ];
}

export function waterRows(cmp: Comparison, beforeDate: string | null): RowView[] {
  return [
    row(cmp, 'tbw', 'Acqua totale TBW', [], beforeDate),
    row(cmp, 'ecw', 'Acqua extracellulare ECW', [], beforeDate),
    row(cmp, 'ecwTbw', 'ECW / TBW', [], beforeDate),
  ];
}

/** Barra FFM/FM: percentuali sul peso (o FFM% = 100 − FM%); `null` se non si possono dire. */
export function splitBar(cmp: Comparison): { ffm: number; fm: number } | null {
  const fm = cmp.fmPct.now?.value;
  const ffm = cmp.ffmPct.now?.value;
  if (fm === undefined || ffm === undefined) return null;
  const total = fm + ffm;
  if (total <= 0) return null;
  // Con FM e FFM misurate la somma può non fare 100: la barra resta proporzionale.
  return { ffm: (ffm / total) * 100, fm: (fm / total) * 100 };
}

// --- Circonferenze ---

export interface CircView {
  key: MetricKey;
  label: string;
  value: string;
  /** Lunghezza della barra (0–1), in scala sulla circonferenza più grande della misura. */
  fraction: number;
  delta: DeltaView | null;
}

export function circumferenceRows(cmp: Comparison): CircView[] {
  const values = CIRCUMFERENCES.map(([k]) => cmp[k].now?.value ?? 0);
  const max = Math.max(0, ...values);
  return CIRCUMFERENCES.map(([key]) => {
    const now = cmp[key].now?.value ?? null;
    return {
      key,
      label: METRICS[key].label,
      value: metricText(key, now),
      fraction: now !== null && max > 0 ? now / max : 0,
      delta: delta(cmp[key], { unit: false }),
    };
  });
}
