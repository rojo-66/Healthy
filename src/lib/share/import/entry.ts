/**
 * Riconoscimento di un link di condivisione. Modulo leggero (niente zod né lz-string):
 * lo usa anche l'intercettazione all'avvio, prima del router.
 */

/** Inizio dell'hash di un link di condivisione (SPEC § 8.4). Non è una rotta (`#/…`). */
export const IMPORT_PREFIX = '#import=';

/**
 * Cosa ha incollato l'utente (o cosa è arrivato nell'indirizzo):
 * - `payload`: il codice compresso di un link (`…#import=<codice>` o il codice da solo);
 * - `json`: il testo di un file di Healthy.
 */
export type ImportText = { type: 'payload'; payload: string } | { type: 'json'; text: string };

export type ExtractResult = { ok: true; value: ImportText } | { ok: false; error: string };

/** L'hash è un link di condivisione (non una rotta `#/…`). */
export function isImportHash(hash: string): boolean {
  return hash.startsWith(IMPORT_PREFIX);
}

/** Codice dopo `#import=` (anche con `%XX` aggiunti da qualche app, spazi e a capo tolti). */
function cleanPayload(raw: string): string {
  let payload = raw;
  if (payload.includes('%')) {
    try {
      payload = decodeURIComponent(payload);
    } catch {
      // Resta com'è: la decodifica dirà che è danneggiato.
    }
  }
  return payload.replace(/\s+/g, '');
}

const CODE_ONLY = /^[A-Za-z0-9+\-$\s]+$/;

/** Riconosce link, codice o JSON in un testo incollato. Non decodifica: dice solo di che si tratta. */
export function extractImport(input: string): ExtractResult {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'Incolla il link o il codice che hai ricevuto.' };
  if (text.startsWith('{')) return { ok: true, value: { type: 'json', text } };
  const at = text.indexOf(IMPORT_PREFIX);
  if (at !== -1) return { ok: true, value: { type: 'payload', payload: cleanPayload(text.slice(at + IMPORT_PREFIX.length)) } };
  if (CODE_ONLY.test(text) && !/^https?$/i.test(text)) return { ok: true, value: { type: 'payload', payload: cleanPayload(text) } };
  return {
    ok: false,
    error: 'Non riconosco un link o un codice di Healthy: incolla il link completo che hai ricevuto (contiene «#import=»).',
  };
}

/** Payload dall'hash dell'indirizzo, se è un link di condivisione. */
export function payloadFromHash(hash: string): string | null {
  return isImportHash(hash) ? cleanPayload(hash.slice(IMPORT_PREFIX.length)) : null;
}
