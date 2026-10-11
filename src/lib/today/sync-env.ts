import { db } from '../data/db';
import { getStorageStatus } from '../data/storage';
import { isStandalone } from '../pwa/standalone';
import type { SyncInputs } from './sync';

/** Il database si apre e si legge (in navigazione privata o con lo storage bloccato fallisce). */
async function probeDatabase(): Promise<boolean> {
  try {
    await db.open();
    await db.settings.get('storagePersist');
    return true;
  } catch {
    return false;
  }
}

/** Legge dal browser le condizioni dell'indicatore (non è puro: `sync.ts` decide cosa mostrare). */
export async function readSyncInputs(): Promise<SyncInputs> {
  const [dbOk, storage] = await Promise.all([probeDatabase(), getStorageStatus()]);
  return {
    dbOk,
    standalone: isStandalone(window),
    swControlled: typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller,
    persisted: storage.persisted,
  };
}
