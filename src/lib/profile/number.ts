import { formatDecimal } from '../diet/format';

/**
 * Numeri scritti a mano nel Profilo, all'italiana: "76,4" e "76.4" valgono uguale.
 * Vuoto = nessun valore (`null`), mai zero. Si mostrano sempre con la virgola.
 */

export type ParsedNumber = { ok: true; value: number | null } | { ok: false; error: string };

export interface ParseOptions {
  /** Solo interi (kcal, anno di nascita): "1.720" con il punto delle migliaia vale 1720. */
  integer?: boolean;
  /** Decimali ammessi (predefinito 2). */
  maxDecimals?: number;
}

const THOUSANDS = /^\d{1,3}(\.\d{3})+$/;

export function parseDecimalInput(text: string, { integer = false, maxDecimals = 2 }: ParseOptions = {}): ParsedNumber {
  const raw = text.trim().replace(/\s/g, '');
  if (raw === '') return { ok: true, value: null };
  if (raw.startsWith('-') || raw.startsWith('−')) return { ok: false, error: 'Inserisci un numero positivo.' };

  if (integer) {
    const clean = THOUSANDS.test(raw) ? raw.replace(/\./g, '') : raw;
    if (!/^\d+$/.test(clean)) return { ok: false, error: 'Inserisci un numero intero, es. 1720.' };
    return { ok: true, value: Number(clean) };
  }

  // Un solo separatore decimale, virgola o punto; almeno una cifra prima ("0,5", non ",5").
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(raw);
  if (!match) return { ok: false, error: 'Inserisci un numero, es. 76,4.' };
  const decimals = match[2] ?? '';
  if (decimals.length > maxDecimals) {
    return { ok: false, error: maxDecimals === 1 ? 'Al massimo un decimale.' : `Al massimo ${maxDecimals} decimali.` };
  }
  return { ok: true, value: Number(`${match[1]}.${decimals || '0'}`) };
}

/** Numero da mettere in un campo: 76.4 → "76,4", `null` → "" (niente punto delle migliaia). */
export function numberToField(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
}

/** Numero da mostrare: virgola decimale, punto delle migliaia ("1.720", "76,4"). */
export function showNumber(value: number, digits: number): string {
  return formatDecimal(value, digits);
}
