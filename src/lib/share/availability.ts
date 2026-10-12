import { formatInt } from '../diet/format';
import { LINK_MAX_CHARS, QR_MAX_CHARS } from './limits';

export interface MethodState {
  ok: boolean;
  /** Perché non si può usare (vuoto se si può). */
  reason: string;
}

export interface ShareAvailability {
  link: MethodState;
  qr: MethodState;
  /** Lunghezza del link intero. */
  chars: number;
}

/** Quali metodi si possono offrire per un link di questa lunghezza (il file c'è sempre). */
export function shareAvailability(urlLength: number): ShareAvailability {
  const linkOk = urlLength <= LINK_MAX_CHARS;
  const qrOk = urlLength <= QR_MAX_CHARS;
  return {
    chars: urlLength,
    link: {
      ok: linkOk,
      reason: linkOk
        ? ''
        : `Troppo lungo per un link (${formatInt(urlLength)} caratteri, massimo ${formatInt(LINK_MAX_CHARS)}): nei messaggi verrebbe tagliato. Usa il file.`,
    },
    qr: {
      ok: qrOk,
      reason: qrOk
        ? ''
        : linkOk
          ? `Troppo lungo per un QR leggibile (${formatInt(urlLength)} caratteri, massimo ${formatInt(QR_MAX_CHARS)}): usa il link o il file.`
          : 'Troppo lungo anche per il QR: usa il file.',
    },
  };
}

/** "3,2 KB" / "850 byte". */
export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${formatInt(bytes)} byte`;
  return `${(bytes / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} KB`;
}
