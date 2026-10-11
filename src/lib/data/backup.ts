import { BACKUP_MIGRATIONS, type BackupMigrations } from './backup-migrations';
import { db as appDb, type HealthyDb } from './db';
import { parseOrThrow, validate, type Result } from './errors';
import { nowIso, toIsoDate } from './ids';
import { MAX_BYTES } from './limits';
import { checkEnvelope, readJsonFile, type FileLike } from './read-file';
import { setSetting } from './repo/settings';
import { TABLE_NAMES, type TableName, type TableRow, type TableRows } from './schemas';
import { APP_ID } from './schemas/common';
import { BACKUP_KIND, BACKUP_VERSION, backupSchema, type Backup, type BackupCounts } from './schemas/backup';
import { isDeviceSetting } from './schemas/settings';

/** Soglia del promemoria di backup (SPEC § 8.5). */
export const BACKUP_STALE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

function rowsOf<T extends TableName>(tables: TableRows, name: T): TableRow<T>[] {
  return tables[name];
}

/** Tutte le tabelle, lette in un'unica transazione. Le impostazioni del telefono restano fuori. */
async function readAllTables(database: HealthyDb): Promise<TableRows> {
  return database.transaction('r', database.tables, async () => {
    const [profile, measurements, exercises, workouts, sessions, dietPlans, dietLog, shopping, settings] =
      await Promise.all([
        database.profile.toArray(),
        database.measurements.toArray(),
        database.exercises.toArray(),
        database.workouts.toArray(),
        database.sessions.toArray(),
        database.dietPlans.toArray(),
        database.dietLog.toArray(),
        database.shopping.toArray(),
        database.settings.toArray(),
      ]);
    return {
      profile,
      measurements,
      exercises,
      workouts,
      sessions,
      dietPlans,
      dietLog,
      shopping,
      settings: settings.filter((row) => !isDeviceSetting(row.key)),
    };
  });
}

function countRows(tables: TableRows): BackupCounts {
  return Object.fromEntries(TABLE_NAMES.map((name) => [name, tables[name].length])) as BackupCounts;
}

/**
 * Backup di tutto il database. Viene validato come se fosse importato:
 * non si produce mai un file che poi non si potrebbe ripristinare.
 */
export async function buildBackup(now: Date = new Date(), database: HealthyDb = appDb): Promise<Backup> {
  const tables = await readAllTables(database);
  return parseOrThrow(backupSchema, {
    app: APP_ID,
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_VERSION,
    createdAt: nowIso(now),
    dbVersion: database.verno,
    counts: countRows(tables),
    tables,
  });
}

/** `healthy-backup-AAAA-MM-GG.json` (giorno locale). */
export function backupFileName(now: Date = new Date()): string {
  return `healthy-backup-${toIsoDate(now)}.json`;
}

export function backupToFile(backup: Backup, now: Date = new Date()): File {
  return new File([JSON.stringify(backup)], backupFileName(now), { type: 'application/json' });
}

/** Porta un backup grezzo dal formato `from` al formato corrente, un passo alla volta. */
function migrate(raw: Record<string, unknown>, from: number, migrations: BackupMigrations): Result<unknown> {
  let data = raw;
  for (let version = from; version < BACKUP_VERSION; version++) {
    const step = migrations[version];
    if (!step) return { ok: false, errors: [`Backup in un formato troppo vecchio (${version}): non più supportato.`] };
    try {
      data = step(data);
    } catch {
      return { ok: false, errors: [`Impossibile aggiornare il backup dal formato ${version}.`] };
    }
    if (data.schemaVersion !== version + 1) {
      return { ok: false, errors: [`Impossibile aggiornare il backup dal formato ${version}.`] };
    }
  }
  return { ok: true, value: data };
}

/**
 * Controlla un backup letto da file: busta, migrazione dai formati vecchi, validazione completa.
 * Un formato più nuovo dell'app viene rifiutato. Non scrive nulla.
 */
export function parseBackup(raw: unknown, migrations: BackupMigrations = BACKUP_MIGRATIONS): Result<Backup> {
  const envelope = checkEnvelope(raw, BACKUP_KIND, BACKUP_VERSION);
  if (!envelope.ok) return envelope;
  const migrated = migrate(raw as Record<string, unknown>, envelope.value, migrations);
  if (!migrated.ok) return migrated;
  return validate(backupSchema, migrated.value);
}

/** Legge e controlla un file di backup scelto dall'utente. */
export async function readBackupFile(file: FileLike, migrations?: BackupMigrations): Promise<Result<Backup>> {
  const json = await readJsonFile(file, MAX_BYTES.backup);
  return json.ok ? parseBackup(json.value, migrations) : json;
}

export interface BackupPreview {
  createdAt: string;
  counts: BackupCounts;
  total: number;
}

/** Riepilogo da mostrare prima di chiedere conferma. */
export function previewBackup(backup: Backup): BackupPreview {
  const total = TABLE_NAMES.reduce((sum, name) => sum + backup.counts[name], 0);
  return { createdAt: backup.createdAt, counts: backup.counts, total };
}

async function replaceTable<T extends TableName>(database: HealthyDb, name: T, rows: TableRow<T>[]): Promise<void> {
  const table = database.tableOf(name);
  await table.clear();
  await table.bulkAdd(rows);
}

/**
 * Sostituisce **tutti** i dati con quelli del backup, in una sola transazione:
 * se una scrittura fallisce, la transazione viene annullata e i dati attuali restano intatti.
 * Le impostazioni del telefono (ultimo backup, persistenza) non vengono toccate.
 */
export function restoreBackup(backup: Backup, database: HealthyDb = appDb): Promise<void> {
  const tables: TableRows = backup.tables;
  return database.transaction('rw', database.tables, async () => {
    for (const name of TABLE_NAMES) {
      if (name === 'settings') {
        await database.settings.filter((row) => !isDeviceSetting(row.key)).delete();
        await database.settings.bulkAdd(tables.settings.filter((row) => !isDeviceSetting(row.key)));
      } else {
        await replaceTable(database, name, rowsOf(tables, name));
      }
    }
  });
}

/** Da chiamare dopo una consegna riuscita del file. */
export function markBackupDone(now: Date = new Date()): Promise<void> {
  return setSetting('lastBackupAt', nowIso(now));
}

/** `true` se non c'è mai stato un backup o l'ultimo ha più di 14 giorni (SPEC § 8.5). */
export function isBackupStale(lastBackupAt: string | null, now: Date): boolean {
  if (lastBackupAt === null) return true;
  const last = Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > BACKUP_STALE_DAYS * DAY_MS;
}
