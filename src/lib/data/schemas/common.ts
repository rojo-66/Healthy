import { z } from 'zod';
import { MAX_TEXT } from '../limits';

/** Valore di `app` in tutti i file di Healthy (SPEC § 8). */
export const APP_ID = 'healthy-app';

/**
 * Testo libero (può essere vuoto): spazi ai lati tolti, lunghezza massima.
 * I testi sono sempre e solo testo: in Svelte vanno mostrati con `{testo}`, mai con `{@html}`.
 */
export const text = (max: number) => z.string().trim().max(max);

/** Testo obbligatorio, non vuoto. */
export const requiredText = (max: number) => z.string().trim().min(1).max(max);

/** Id di una riga: UUID o slug (`lat-machine`). */
export const entityId = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TEXT.key)
  .regex(/^[A-Za-z0-9_-]+$/, 'identificativo non valido: solo lettere, numeri, - e _');

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** Chiave di un dizionario (prodotti, pasti, tipi di giornata): minuscole, numeri, `-` e `_`. */
export const safeKey = z
  .string()
  .regex(/^[a-z0-9_][a-z0-9_-]{0,39}$/, 'chiave non valida: usa minuscole, numeri, - e _ (massimo 40)')
  .refine((key) => !FORBIDDEN_KEYS.has(key), 'chiave riservata, non ammessa');

/** Giorno `AAAA-MM-GG` (data reale: niente 2026-02-31). */
export const isoDate = z.iso.date();

/** Istante ISO 8601 in UTC, come lo produce `Date.toISOString()`. */
export const isoDateTime = z.iso.datetime();

/** Orario `HH:MM`. */
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'orario non valido: usa il formato HH:MM');

/** Link esterno (video): solo `https://`, mai `javascript:` o altro. */
export const httpsUrl = z.url({ protocol: /^https$/ }).max(MAX_TEXT.url);

/** Giorno della settimana: 1 = lunedì … 7 = domenica (come § 8.1). */
const WEEKDAY_RANGE = 'giorno non valido: usa 1 = lunedì … 7 = domenica';
export const weekday = z.number().int().min(1, WEEKDAY_RANGE).max(7, WEEKDAY_RANGE);

/** Numero finito tra `min` e `max`. */
export const num = (min: number, max: number) => z.number().min(min).max(max);

/** Intero tra `min` e `max`. */
export const int = (min: number, max: number) => z.number().int().min(min).max(max);

/** Elenco senza doppioni (confronto con `===`). */
export function uniqueArray<T extends z.ZodType>(item: T, max: number, message = 'valori ripetuti') {
  return z
    .array(item)
    .max(max)
    .refine((values) => new Set(values).size === values.length, message);
}

/** Busta comune dei file (SPEC § 8): `app`, `kind`, `schemaVersion`. */
export function envelope<K extends string, V extends number>(kind: K, schemaVersion: V) {
  return {
    app: z.literal(APP_ID),
    kind: z.literal(kind),
    schemaVersion: z.literal(schemaVersion),
  };
}
