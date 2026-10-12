import { encode } from 'uqr';

/**
 * QR del link, generato sul telefono (nessun servizio esterno). Correzione d'errore L: il QR resta più
 * rado a parità di lunghezza (sullo schermo non ci sono macchie o pieghe da correggere).
 * Chunk caricato a richiesta (pannello Condividi), nel precache per l'uso offline.
 */
export interface QrDrawing {
  /** Lato in moduli, margine compreso. */
  size: number;
  /** `d` di un `<path>`: un rettangolo per ogni tratto di moduli scuri. */
  path: string;
  version: number;
}

/** Margine di 4 moduli chiari (zona di rispetto richiesta dallo standard). */
export const QR_MARGIN = 4;

export function qrDrawing(text: string, margin: number = QR_MARGIN): QrDrawing {
  const qr = encode(text, { ecc: 'L', border: 0 });
  const parts: string[] = [];
  qr.data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      parts.push(`M${start + margin} ${y + margin}h${x - start}v1h-${x - start}z`);
    }
  });
  return { size: qr.size + 2 * margin, path: parts.join(''), version: qr.version };
}

/** Matrice (per i test di lettura): `true` = modulo scuro, margine compreso. */
export function qrModules(text: string, margin: number = QR_MARGIN): boolean[][] {
  const qr = encode(text, { ecc: 'L', border: 0 });
  const size = qr.size + 2 * margin;
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => qr.data[y - margin]?.[x - margin] === true),
  );
}
