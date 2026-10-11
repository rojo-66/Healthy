import { nowIso } from './ids';
import { setSetting } from './repo/settings';

/**
 * Persistenza dello storage (SPEC § 2, § 10). Senza persistenza il browser può cancellare IndexedDB
 * quando lo spazio scarseggia. Su iPhone Safari e l'app installata hanno storage **separati**: queste
 * funzioni riguardano solo il contesto in cui l'app è aperta (l'avviso di installazione è in `pwa/`).
 */

/** Sottoinsieme di `navigator.storage`: permette di testare con oggetti finti. */
export interface StorageLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

export interface StorageStatus {
  /** Il browser espone la StorageManager API. */
  supported: boolean;
  /** `null` = non si può sapere. */
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

function browserStorage(): StorageLike | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

async function tryCall<T>(fn: (() => Promise<T>) | undefined, owner: StorageLike): Promise<T | null> {
  if (!fn) return null;
  try {
    return await fn.call(owner);
  } catch {
    return null;
  }
}

/** Chiede la persistenza se non c'è già. `null` se l'API manca o fallisce. */
export async function requestPersistence(storage: StorageLike | undefined = browserStorage()): Promise<boolean | null> {
  if (!storage) return null;
  if ((await tryCall(storage.persisted, storage)) === true) return true;
  return tryCall(storage.persist, storage);
}

/**
 * All'avvio: chiede la persistenza e salva l'esito in `settings` (`storagePersist`).
 * Va chiamata a ogni avvio: Safari può concederla più tardi. Non lancia mai.
 */
export async function initStorage(
  storage: StorageLike | undefined = browserStorage(),
  now: Date = new Date(),
): Promise<boolean | null> {
  const granted = await requestPersistence(storage);
  if (granted !== null) {
    try {
      await setSetting('storagePersist', { granted, checkedAt: nowIso(now) });
    } catch {
      // Database non disponibile (es. navigazione privata): l'app funziona lo stesso.
    }
  }
  return granted;
}

/** Dimensione leggibile in italiano: "812 KB", "1,4 MB", "2 GB". */
export function formatBytes(bytes: number): string {
  const units = ['byte', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toLocaleString('it-IT', { maximumFractionDigits: digits })} ${units[unit]}`;
}

/** Sola lettura: persistenza attiva e spazio usato, con `null` dove il browser non lo dice. */
export async function getStorageStatus(storage: StorageLike | undefined = browserStorage()): Promise<StorageStatus> {
  if (!storage) return { supported: false, persisted: null, usageBytes: null, quotaBytes: null };
  const persisted = await tryCall(storage.persisted, storage);
  const estimate = await tryCall(storage.estimate, storage);
  const bytes = (value: number | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  return {
    supported: true,
    persisted,
    usageBytes: bytes(estimate?.usage),
    quotaBytes: bytes(estimate?.quota),
  };
}
