import type { Dexie, Transaction } from 'dexie';
import { migrateExerciseRow, migrateSessionRow, migrateSettingRow, migrateWorkoutRow } from './migrations/cardio';
import { calendarStartSetting, localIsoDate, migrateDietLogRowV4 } from './migrations/calendar-v4';
import { migrateDietLogRow, migrateDietPlanRow } from './migrations/diet-v3';
import type { TableName } from './schemas';

/**
 * Una versione dello schema del database.
 * Per cambiare indici o trasformare dati: **aggiungere** una versione in fondo, mai modificare quelle esistenti.
 * In `stores` basta elencare le tabelle che cambiano (`null` cancella una tabella); `upgrade` trasforma i dati
 * già salvati e gira una sola volta, dentro la transazione di aggiornamento (se fallisce, resta la versione vecchia).
 */
export interface DbVersion {
  readonly version: number;
  readonly stores: Readonly<Partial<Record<TableName | (string & {}), string | null>>>;
  readonly upgrade?: (tx: Transaction) => PromiseLike<unknown> | void;
}

/**
 * Chiave primaria per prima, poi gli indici (sintassi Dexie: `*` = un indice per ogni valore dell'elenco,
 * `[a+b]` = indice composto). I booleani non sono indicizzabili in IndexedDB: si filtrano in memoria.
 */
export const DB_VERSIONS: readonly DbVersion[] = [
  {
    version: 1,
    stores: {
      profile: 'id',
      measurements: 'id, date',
      exercises: 'id, name, *muscles',
      workouts: 'id, updatedAt, *weekdays',
      // [workoutId+startedAt]: "ultima volta" con la stessa scheda; serve anche per cercare per workoutId.
      sessions: 'id, startedAt, [workoutId+startedAt]',
      dietPlans: 'id, validFrom',
      dietLog: 'date, planId',
      shopping: 'weekStart',
      settings: 'key',
    },
  },
  {
    // M5: le sessioni hanno la copia della scheda (`snapshot`) e lo stato della sessione in corso (`live`).
    // Indici invariati; le righe già salvate ricevono i campi nuovi vuoti.
    version: 2,
    stores: {},
    upgrade: (tx) =>
      tx
        .table('sessions')
        .toCollection()
        .modify((s: Record<string, unknown>) => {
          if (!('snapshot' in s)) s.snapshot = null;
          if (!('live' in s)) s.live = null;
        }),
  },
  {
    // M6: le schede hanno un orario facoltativo (`time`, Home e timeline). Indici invariati.
    version: 3,
    stores: {},
    upgrade: (tx) =>
      tx
        .table('workouts')
        .toCollection()
        .modify((w: Record<string, unknown>) => {
          if (!('time' in w)) w.time = null;
        }),
  },
  {
    // M7: il profilo ha il livello di attività (stima delle kcal). Indici invariati.
    version: 4,
    stores: {},
    upgrade: (tx) =>
      tx
        .table('profile')
        .toCollection()
        .modify((p: Record<string, unknown>) => {
          if (!('activityLevel' in p)) p.activityLevel = 'sedentary';
        }),
  },
  {
    // M8: le schede ricevute ricordano versione e impronta dell'import (`received`) e conservano
    // le versioni sostituite (`previousVersions`). Indici invariati.
    version: 5,
    stores: {},
    upgrade: (tx) =>
      tx
        .table('workouts')
        .toCollection()
        .modify((w: Record<string, unknown>) => {
          if (!('received' in w)) w.received = null;
          if (!('previousVersions' in w)) w.previousVersions = [];
        }),
  },
  {
    // Modello per Claude: i piani alimentari hanno le indicazioni generali del nutrizionista. Indici invariati.
    version: 6,
    stores: {},
    upgrade: (tx) =>
      tx
        .table('dietPlans')
        .toCollection()
        .modify((p: { payload?: Record<string, unknown> }) => {
          if (p.payload && !('generalNotes' in p.payload)) p.payload.generalNotes = '';
        }),
  },
  {
    // 2a: il "cardio finale" diventa un esercizio cardio (schede, cronologia, sessioni, bozza dell'editor),
    // gli esercizi hanno un tipo; nuove tabelle per la corsa (pianificata e fatta).
    version: 7,
    stores: {
      runs: 'id, updatedAt, *weekdays',
      runLogs: 'id, date, [runId+date]',
    },
    upgrade: async (tx) => {
      await replaceRows(tx, 'exercises', migrateExerciseRow);
      await replaceRows(tx, 'workouts', migrateWorkoutRow);
      await replaceRows(tx, 'sessions', migrateSessionRow);
      await replaceRows(tx, 'settings', migrateSettingRow);
    },
  },
  {
    // 2b: piano alimentare v3 (varianti per tipo di giornata, anche nei piani archiviati); nel diario lo scambio
    // "oggi seguo il piano di un altro giorno" diventa la fonte dei pasti (`mealsFrom`). Indici invariati.
    version: 8,
    stores: {},
    upgrade: async (tx) => {
      await replaceRows(tx, 'dietPlans', migrateDietPlanRow);
      await replaceRows(tx, 'dietLog', migrateDietLogRow);
    },
  },
  {
    // 2c: calendario delle attività. Eccezioni per data (spostamenti e salti) e dieta scelta nei giorni con palestra e
    // corsa; nel diario la fonte dei pasti spuntati (restano com'erano se il tipo di giornata cambia); da oggi il tipo
    // di giornata viene dalle attività (`calendarStart`: lo storico resta quello del piano).
    version: 9,
    stores: {
      calendarEdits: 'key, originalDate, toDate',
      dayChoices: 'date',
    },
    upgrade: async (tx) => {
      await replaceRows(tx, 'dietLog', migrateDietLogRowV4);
      const settings = tx.table('settings');
      if ((await settings.get('calendarStart')) === undefined) await settings.put(calendarStartSetting(localIsoDate(new Date())));
    },
  },
];

/** Sostituisce le righe di una tabella con la loro versione migrata (solo quelle che cambiano). */
async function replaceRows(tx: Transaction, table: string, migrate: (row: unknown) => unknown): Promise<void> {
  await tx
    .table(table)
    .toCollection()
    .modify((row: unknown, ctx: { value: unknown }) => {
      const next = migrate(row);
      if (next !== row) ctx.value = next;
    });
}

export function applyVersions(db: Dexie, versions: readonly DbVersion[]): void {
  for (const { version, stores, upgrade } of versions) {
    const v = db.version(version).stores(stores as Record<string, string | null>);
    if (upgrade) v.upgrade(upgrade);
  }
}

/** Versione corrente dello schema (ultima della lista). */
export function latestVersion(versions: readonly DbVersion[] = DB_VERSIONS): number {
  return versions.reduce((max, v) => Math.max(max, v.version), 0);
}
