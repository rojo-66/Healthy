import * as jsqrModule from 'jsqr';

/**
 * Lettura di un QR da un fotogramma (jsQR, licenza Apache-2.0). Nessun lettore nativo su iPhone
 * (`BarcodeDetector` non c'è in Safari). Chunk caricato solo con "Scansiona QR", nel precache.
 */
type JsQr = typeof import('jsqr').default;

/** jsQR è un modulo UMD/CommonJS: la funzione può stare in `default` (o in `default.default`). */
function resolve(mod: unknown): JsQr {
  let current: unknown = mod;
  for (let i = 0; i < 3 && typeof current !== 'function'; i++) {
    current = (current as { default?: unknown } | null)?.default;
  }
  if (typeof current !== 'function') throw new Error('jsQR non disponibile');
  return current as JsQr;
}

const jsQR = resolve(jsqrModule);

export interface Frame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Testo del QR nel fotogramma, `null` se non se ne trova uno. Il QR del pannello è scuro su chiaro. */
export function decodeQr(frame: Frame): string | null {
  const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
  return code ? code.data : null;
}
