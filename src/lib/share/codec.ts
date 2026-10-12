import * as lzModule from 'lz-string';
import type { Result } from '../data/errors';
import { parseJsonText } from '../data/read-file';
import { formatInt } from '../diet/format';
import { canonicalJson } from './canonical';
import { decompressUriSafe, URI_SAFE_ALPHABET } from './lz-decompress';
import { DECOMPRESSED_MAX_CHARS, PAYLOAD_MAX_CHARS } from './limits';
import { IMPORT_PREFIX } from './import/entry';

/** lz-string è CommonJS: a seconda dell'ambiente le funzioni stanno nel modulo o in `default`. */
const lz = (lzModule as unknown as { default?: typeof lzModule }).default ?? lzModule;

export { IMPORT_PREFIX };

/**
 * Indirizzo dell'app: origine + `base` di Vite, mai scritto a mano (il nome del repository può cambiare).
 * Es. `https://rojo-66.github.io/Healthy/`.
 */
export function appBaseUrl(origin: string = location.origin, base: string = import.meta.env.BASE_URL): string {
  return origin + (base.endsWith('/') ? base : `${base}/`);
}

export interface EncodedShare {
  /** Codice da incollare (solo i caratteri di `URI_SAFE_ALPHABET`). */
  payload: string;
  /** Link completo `…/#import=<payload>`. */
  url: string;
}

/** Contenuto (già validato e, se si vuole, compattato) → payload compresso e link. */
export function encodeShare(content: unknown, baseUrl: string = appBaseUrl()): EncodedShare {
  const payload = lz.compressToEncodedURIComponent(canonicalJson(content));
  return { payload, url: `${baseUrl}${IMPORT_PREFIX}${payload}` };
}

const fail = (message: string): { ok: false; errors: string[] } => ({ ok: false, errors: [message] });

export const TRUNCATED_MESSAGE =
  'Il link è incompleto: probabilmente è stato tagliato dal messaggio. Chiedi di rimandarlo o usa il file.';

const ALLOWED = new Set(URI_SAFE_ALPHABET);

/**
 * Payload → dati, in modo difensivo e senza mai lanciare:
 * lunghezza (prima di tutto) → caratteri ammessi → decompressione con tetto → JSON.
 * La validazione dei dati (zod) è del chiamante.
 */
export function decodePayload(raw: string): Result<unknown> {
  // Gli spazi possono arrivare da un "+" decodificato: il decompressore li ritrasforma.
  const payload = raw.replace(/[\r\n\t]/g, '');
  if (payload.trim() === '') return fail('Il link non contiene dati: incolla il link completo che hai ricevuto.');
  if (payload.length > PAYLOAD_MAX_CHARS) {
    return fail(
      `Il codice è troppo lungo per un link di Healthy (${formatInt(payload.length)} caratteri, massimo ${formatInt(PAYLOAD_MAX_CHARS)}). Chiedi il file.`,
    );
  }
  for (const ch of payload) {
    if (ch !== ' ' && !ALLOWED.has(ch)) {
      return fail('Il link contiene caratteri non validi: forse è stato modificato o copiato male. Chiedi di rimandarlo o usa il file.');
    }
  }
  const text = decompressUriSafe(payload, DECOMPRESSED_MAX_CHARS);
  if (!text.ok) {
    if (text.reason === 'too-big') return fail('Il contenuto del link è troppo grande per una scheda o una dieta.');
    return fail(TRUNCATED_MESSAGE);
  }
  if (text.text === '') return fail(TRUNCATED_MESSAGE);
  return parseJsonText(text.text, TRUNCATED_MESSAGE, 'Il link');
}
