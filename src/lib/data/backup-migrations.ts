import { backupV1ToV2 } from './migrations/cardio';
import { backupV3ToV4 } from './migrations/calendar-v4';
import { backupV2ToV3 } from './migrations/diet-v3';

/**
 * Migrazioni del formato di backup: la chiave `n` trasforma un backup del formato `n` nel formato `n + 1`
 * (e deve impostare `schemaVersion: n + 1`). Lavorano sul JSON grezzo: la validazione completa avviene dopo,
 * sul risultato finale. Il ripristino non fa girare le `upgrade` di Dexie: ogni cambio dei dati salvati
 * va ripetuto qui (con le stesse funzioni), altrimenti zod scarterebbe in silenzio i campi vecchi.
 */
export type BackupMigration = (data: Record<string, unknown>) => Record<string, unknown>;

export type BackupMigrations = Readonly<Record<number, BackupMigration>>;

export const BACKUP_MIGRATIONS: BackupMigrations = {
  /** 2a: cardio come esercizio, esercizi con tipo, tabelle `runs` e `runLogs`. */
  1: backupV1ToV2,
  /** 2b: piani alimentari v3 con le varianti, diario con la fonte dei pasti (`mealsFrom`). */
  2: backupV2ToV3,
  /** 2c: tabelle del calendario, fonte dei pasti spuntati, inizio del calendario (`calendarStart`). */
  3: backupV3ToV4,
};
