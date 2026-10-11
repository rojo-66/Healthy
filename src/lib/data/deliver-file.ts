/**
 * Consegna un file all'utente. Su iPhone: foglio di condivisione iOS (Salva su File, AirDrop, Mail…)
 * con la Web Share API; altrove, o se manca, download classico.
 */
export type DeliveryResult =
  /** Condiviso con il foglio di condivisione. */
  | 'shared'
  /** Scaricato con un link `download`. */
  | 'downloaded'
  /** L'utente ha chiuso il foglio di condivisione: non è un errore. */
  | 'cancelled'
  /**
   * Il browser ha rifiutato la condivisione perché è passato troppo tempo dal tocco (Safari "consuma"
   * il gesto durante le attese): serve un nuovo tocco che richiami `deliverFile` con lo stesso file.
   */
  | 'needs-gesture';

/** Quel che serve dell'ambiente: permette di testare con oggetti finti. */
export interface DeliveryEnv {
  navigator: {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  document: Pick<Document, 'createElement' | 'body'>;
  url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  setTimeout: (callback: () => void, ms: number) => unknown;
}

function browserEnv(): DeliveryEnv {
  return { navigator, document, url: URL, setTimeout: (callback, ms) => window.setTimeout(callback, ms) };
}

function errorName(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
    ? error.name
    : null;
}

export function canShareFile(file: File, env: DeliveryEnv = browserEnv()): boolean {
  const { canShare, share } = env.navigator;
  if (!share || !canShare) return false;
  try {
    return canShare.call(env.navigator, { files: [file] });
  } catch {
    return false;
  }
}

function download(file: File, env: DeliveryEnv): void {
  const href = env.url.createObjectURL(file);
  const link = env.document.createElement('a');
  link.href = href;
  link.download = file.name;
  link.rel = 'noopener';
  link.style.display = 'none';
  env.document.body.append(link);
  link.click();
  link.remove();
  // Revocare subito può interrompere il download in Safari.
  env.setTimeout(() => env.url.revokeObjectURL(href), 60_000);
}

export async function deliverFile(file: File, env: DeliveryEnv = browserEnv()): Promise<DeliveryResult> {
  if (canShareFile(file, env) && env.navigator.share) {
    try {
      await env.navigator.share.call(env.navigator, { files: [file] });
      return 'shared';
    } catch (error) {
      const name = errorName(error);
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'needs-gesture';
      // Altri errori (es. tipo di file rifiutato): si ripiega sul download.
    }
  }
  download(file, env);
  return 'downloaded';
}

/** Solo download (alternativa esplicita al foglio di condivisione, es. "Scarica il file"). */
export function downloadFile(file: File, env: DeliveryEnv = browserEnv()): void {
  download(file, env);
}
