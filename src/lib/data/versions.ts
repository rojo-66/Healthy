import type { Dexie, Transaction } from 'dexie';
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
];

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
