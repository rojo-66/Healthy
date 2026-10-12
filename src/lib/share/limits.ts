import { MAX_BYTES } from '../data/limits';

/**
 * Soglie della condivisione (SPEC § 8.4). Una sola fonte: pannello Condividi, decodifica e test.
 * Valori decisi in M8, da riverificare su iPhone (Messaggi, WhatsApp, QR letto da un altro telefono).
 */

/** Link intero (origine + base + `#import=` + payload): oltre si offre solo il file. */
export const LINK_MAX_CHARS = 4000;

/**
 * QR del link (correzione d'errore L, al massimo ≈ versione 28, 129 × 129 moduli): oltre diventa
 * troppo fitto per leggerlo da uno schermo all'altro. Oltre si offrono link e file.
 */
export const QR_MAX_CHARS = 1500;

/** Payload accettato in ingresso, controllato **prima** di decomprimere (con margine sulla soglia del link). */
export const PAYLOAD_MAX_CHARS = 6000;

/** Testo massimo dopo la decompressione (come un file condiviso): la decompressione si ferma prima. */
export const DECOMPRESSED_MAX_CHARS = MAX_BYTES.share;
