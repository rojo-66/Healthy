import { payloadFromHash } from './entry';

/**
 * Link di condivisione arrivato nell'indirizzo (`…/#import=<codice>`), in attesa della schermata Importa.
 * Resta solo in memoria: dopo la lettura l'hash diventa `#/importa?da=link`, così una ricarica (o "indietro")
 * non rilancia l'import e il codice non resta nella cronologia.
 */
export const pendingImport = $state<{ payload: string | null; token: number }>({ payload: null, token: 0 });

/** Rotta della schermata Importa quando si arriva da un link. */
export const LINK_IMPORT_HASH = '#/importa?da=link';

/** Prende il link in attesa (una volta sola). */
export function takePendingImport(): string | null {
  const payload = pendingImport.payload;
  pendingImport.payload = null;
  return payload;
}

/** Quel che serve di `window` (test con oggetti finti). */
export interface InterceptEnv {
  location: { hash: string; replace(url: string): void };
  history: { state: unknown; replaceState(data: unknown, unused: string, url: string): void };
  addEventListener(type: 'hashchange', listener: () => void): void;
}

function capture(hash: string): boolean {
  const payload = payloadFromHash(hash);
  if (payload === null) return false;
  pendingImport.payload = payload;
  pendingImport.token++;
  return true;
}

/**
 * Intercetta `#import=` **prima del router** (va chiamata prima che il router legga l'indirizzo):
 * - all'avvio: `history.replaceState` → `#/importa?da=link` (nessuna nuova voce, niente navigazione);
 * - con l'app già aperta (`hashchange`): `location.replace`, così la voce con il codice non resta indietro.
 */
export function interceptImportHash(env: InterceptEnv = window): void {
  if (capture(env.location.hash)) env.history.replaceState(env.history.state, '', LINK_IMPORT_HASH);
  env.addEventListener('hashchange', () => {
    if (capture(env.location.hash)) env.location.replace(LINK_IMPORT_HASH);
  });
}
