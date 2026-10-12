/**
 * Condivisione di un link con il foglio di condivisione di iOS e copia negli appunti.
 * Stessi esiti di `deliverFile` (M2): chiudere il foglio non è un errore.
 */
export type LinkShareResult = 'shared' | 'cancelled' | 'needs-gesture' | 'unsupported';

export interface LinkShareEnv {
  share?: (data: ShareData) => Promise<void>;
}

export interface ClipboardEnv {
  clipboard?: { writeText(text: string): Promise<void> };
}

function errorName(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string' ? error.name : null;
}

/** Web Share di tipo URL. Va chiamata subito dentro il tocco: il link deve essere già pronto. */
export async function shareLink(
  data: { url: string; title: string },
  env: LinkShareEnv = navigator as LinkShareEnv,
): Promise<LinkShareResult> {
  if (!env.share) return 'unsupported';
  try {
    await env.share.call(env, { title: data.title, url: data.url });
    return 'shared';
  } catch (error) {
    const name = errorName(error);
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError') return 'needs-gesture';
    return 'unsupported';
  }
}

/** Copia negli appunti; `false` se il browser non lo permette (si mostra il testo da copiare a mano). */
export async function copyText(text: string, env: ClipboardEnv = navigator as ClipboardEnv): Promise<boolean> {
  if (!env.clipboard) return false;
  try {
    await env.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
