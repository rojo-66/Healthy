import { z } from 'zod';
import { MAX_ITEMS } from '../limits';
import { envelope, int, isoDateTime } from './common';
import { PRIMARY_KEYS, TABLE_LABELS, TABLE_NAMES, TABLE_SCHEMAS, type TableName, type TableRows } from './index';

export const BACKUP_KIND = 'backup';
/** Versione del formato di backup. Se cambia, aggiungere la migrazione in `backup-migrations.ts`. */
export const BACKUP_VERSION = 4;

function rows<T extends TableName>(table: T) {
  return z.array(TABLE_SCHEMAS[table]).max(MAX_ITEMS.rows[table]);
}

function count<T extends TableName>(table: T) {
  return int(0, MAX_ITEMS.rows[table]);
}

export const backupTablesSchema = z.object({
  profile: rows('profile'),
  measurements: rows('measurements'),
  exercises: rows('exercises'),
  workouts: rows('workouts'),
  sessions: rows('sessions'),
  runs: rows('runs'),
  runLogs: rows('runLogs'),
  calendarEdits: rows('calendarEdits'),
  dayChoices: rows('dayChoices'),
  dietPlans: rows('dietPlans'),
  dietLog: rows('dietLog'),
  shopping: rows('shopping'),
  settings: rows('settings'),
});

export const backupCountsSchema = z.object({
  profile: count('profile'),
  measurements: count('measurements'),
  exercises: count('exercises'),
  workouts: count('workouts'),
  sessions: count('sessions'),
  runs: count('runs'),
  runLogs: count('runLogs'),
  calendarEdits: count('calendarEdits'),
  dayChoices: count('dayChoices'),
  dietPlans: count('dietPlans'),
  dietLog: count('dietLog'),
  shopping: count('shopping'),
  settings: count('settings'),
});

/** File di backup (SPEC § 8.5): tutto il database in un unico JSON. */
export const backupSchema = z
  .object({
    ...envelope(BACKUP_KIND, BACKUP_VERSION),
    createdAt: isoDateTime,
    /** Versione del database che l'ha prodotto (informativa). */
    dbVersion: int(1, 10000),
    counts: backupCountsSchema,
    tables: backupTablesSchema,
  })
  .superRefine((backup, ctx) => {
    const tables: TableRows = backup.tables;
    for (const table of TABLE_NAMES) {
      const list: readonly Record<string, unknown>[] = tables[table];
      const label = TABLE_LABELS[table];

      // Conteggi diversi dalle righe: file troncato o modificato a mano.
      if (backup.counts[table] !== list.length) {
        ctx.addIssue({
          code: 'custom',
          path: [],
          message: `${label}: il backup dichiara ${backup.counts[table]} righe ma ne contiene ${list.length} (file incompleto?)`,
        });
      }

      const keyField = PRIMARY_KEYS[table];
      const seen = new Set<unknown>();
      for (const row of list) {
        const key = row[keyField];
        if (seen.has(key)) {
          ctx.addIssue({ code: 'custom', path: [], message: `${label}: la chiave «${String(key)}» compare due volte` });
        }
        seen.add(key);
      }
    }

    if (tables.dietPlans.filter((plan) => plan.active).length > 1) {
      ctx.addIssue({ code: 'custom', path: [], message: 'Piani alimentari: più di un piano risulta attivo' });
    }
  });

export type Backup = z.infer<typeof backupSchema>;
export type BackupCounts = z.infer<typeof backupCountsSchema>;
