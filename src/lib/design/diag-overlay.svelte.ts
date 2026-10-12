/**
 * Diagnostica dello schermo sopra l'app (Strumenti tecnici): resta visibile su tutte le schermate, così i
 * numeri si leggono proprio mentre il difetto è sullo schermo. Preferenza di questo telefono (localStorage);
 * se il browser non la conserva, semplicemente non resta attiva.
 */
const KEY = 'healthy-diag-overlay';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const diagOverlay = $state({ enabled: read() });

export function setDiagOverlay(enabled: boolean): void {
  diagOverlay.enabled = enabled;
  try {
    if (enabled) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Solo per questa apertura.
  }
}
