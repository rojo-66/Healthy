/**
 * Fotocamera per "Scansiona QR": solo durante la scansione, sempre spenta alla fine.
 * Messaggi chiari se manca o se il permesso è negato, con l'alternativa (incolla o file).
 */

export const CAMERA_UNSUPPORTED =
  'Qui non si può usare la fotocamera: incolla il link o scegli il file.';

function errorName(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string' ? error.name : null;
}

/** Errore di `getUserMedia` → messaggio in italiano con l'alternativa. */
export function cameraErrorMessage(error: unknown): string {
  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Hai negato l’accesso alla fotocamera. Puoi consentirlo in Impostazioni › Safari › Fotocamera, oppure incolla il link o scegli il file.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Non trovo una fotocamera su questo telefono: incolla il link o scegli il file.';
    case 'NotReadableError':
    case 'AbortError':
      return 'La fotocamera è occupata da un’altra app: chiudila e riprova, oppure incolla il link.';
    default:
      return 'Non riesco ad avviare la fotocamera: incolla il link o scegli il file.';
  }
}

/** Fotocamera posteriore, risoluzione sufficiente per un QR fitto letto da un altro schermo. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
};

/** Spegne tutte le tracce (la spia della fotocamera si spegne). */
export function stopStream(stream: Pick<MediaStream, 'getTracks'> | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Lato massimo del fotogramma analizzato: abbastanza per il QR, leggero per jsQR. */
export const SCAN_MAX_SIDE = 960;

/** Dimensioni del fotogramma ridotto. */
export function scanSize(width: number, height: number, max: number = SCAN_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
