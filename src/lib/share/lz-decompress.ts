/**
 * Decompressione dei payload di `compressToEncodedURIComponent`, con un **tetto sulla lunghezza dell'uscita**.
 *
 * È il decompressore di lz-string 1.5.0 (© 2013 pieroxy, licenza MIT, https://github.com/pieroxy/lz-string),
 * riscritto in TypeScript. Una differenza voluta: lz-string decomprime tutto e solo dopo si potrebbe
 * controllare la dimensione; un payload costruito ad arte di pochi KB può espandersi a decine di MB.
 * Qui ci si ferma appena l'uscita supera `maxChars` (anche il dizionario resta proporzionale all'uscita).
 * Per comprimere si usa la libreria originale (`lz-string`).
 */

/** Alfabeto di `compressToEncodedURIComponent`: sicuro negli URL, niente da codificare. */
export const URI_SAFE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';

const VALUE: ReadonlyMap<string, number> = new Map([...URI_SAFE_ALPHABET].map((ch, i) => [ch, i]));

export type DecompressResult =
  | { ok: true; text: string }
  /** Caratteri fuori dall'alfabeto o codici impossibili: non è un payload valido. */
  | { ok: false; reason: 'invalid' }
  /** Il payload finisce prima del segnale di fine: è stato tagliato. */
  | { ok: false; reason: 'truncated' }
  /** L'uscita supererebbe `maxChars`. */
  | { ok: false; reason: 'too-big' };

const RESET = 32; // 6 bit per carattere

export function decompressUriSafe(input: string, maxChars: number): DecompressResult {
  // Alcuni programmi trasformano "+" in spazio (come lz-string).
  const data = input.replace(/ /g, '+');
  const length = data.length;
  if (length === 0) return { ok: false, reason: 'truncated' };
  const values: number[] = new Array<number>(length);
  for (let i = 0; i < length; i++) {
    const v = VALUE.get(data.charAt(i));
    if (v === undefined) return { ok: false, reason: 'invalid' };
    values[i] = v;
  }

  let val = values[0] ?? 0;
  let position = RESET;
  let index = 1;

  const readBits = (count: number): number => {
    let bits = 0;
    const max = 2 ** count;
    let power = 1;
    while (power !== max) {
      const resb = val & position;
      position >>= 1;
      if (position === 0) {
        position = RESET;
        val = values[index++] ?? 0;
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }
    return bits;
  };

  const dictionary: string[] = [];
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let outLength = 0;
  const result: string[] = [];

  let first: string;
  switch (readBits(2)) {
    case 0:
      first = String.fromCharCode(readBits(8));
      break;
    case 1:
      first = String.fromCharCode(readBits(16));
      break;
    case 2:
      return { ok: true, text: '' };
    default:
      return { ok: false, reason: 'invalid' };
  }
  dictionary[3] = first;
  let w = first;
  result.push(first);
  outLength = 1;

  for (;;) {
    if (index > length) return { ok: false, reason: 'truncated' };
    let c = readBits(numBits);
    switch (c) {
      case 0:
        dictionary[dictSize++] = String.fromCharCode(readBits(8));
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 1:
        dictionary[dictSize++] = String.fromCharCode(readBits(16));
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 2:
        return { ok: true, text: result.join('') };
    }

    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }

    let entry: string;
    const known = dictionary[c];
    if (known !== undefined) entry = known;
    else if (c === dictSize) entry = w + w.charAt(0);
    else return { ok: false, reason: 'invalid' };

    outLength += entry.length;
    if (outLength > maxChars) return { ok: false, reason: 'too-big' };
    result.push(entry);

    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn--;
    w = entry;

    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }
  }
}
