/**
 * Migrazioni del formato di backup: la chiave `n` trasforma un backup del formato `n` nel formato `n + 1`
 * (e deve impostare `schemaVersion: n + 1`). Lavorano sul JSON grezzo: la validazione completa avviene dopo,
 * sul risultato finale. Oggi esiste solo il formato 1, quindi l'elenco è vuoto.
 *
 * Esempio, quando servirà un formato 2:
 *   1: (v1) => ({ ...v1, schemaVersion: 2, tables: { ...(v1.tables as object), nuovaTabella: [] } }),
 */
export type BackupMigration = (data: Record<string, unknown>) => Record<string, unknown>;

export type BackupMigrations = Readonly<Record<number, BackupMigration>>;

export const BACKUP_MIGRATIONS: BackupMigrations = {};
