import { db as appDb, type HealthyDb } from '../db';
import { TABLE_NAMES, type TableName } from '../schemas';
import { isDeviceSetting } from '../schemas/settings';

export type TableCounts = Record<TableName, number>;

/**
 * Righe per tabella, lette in un'unica transazione (numeri coerenti tra loro).
 * Come nel backup, le impostazioni del telefono non contano: dopo "Svuota tutto" è tutto a zero.
 */
export function countAll(database: HealthyDb = appDb): Promise<TableCounts> {
  return database.transaction('r', database.tables, async () => {
    const counts = await Promise.all(
      TABLE_NAMES.map((name) =>
        name === 'settings'
          ? database.settings.filter((row) => !isDeviceSetting(row.key)).count()
          : database.tableOf(name).count(),
      ),
    );
    return Object.fromEntries(TABLE_NAMES.map((name, i) => [name, counts[i] ?? 0])) as TableCounts;
  });
}

/**
 * Svuota tutte le tabelle in una transazione (o tutto o niente).
 * Restano solo le impostazioni del telefono (ultimo backup, persistenza): non sono dati dell'utente.
 * Il database resta: si svuota, non si cancella (e quello di MyDiet non viene mai toccato).
 */
export function clearAll(database: HealthyDb = appDb): Promise<void> {
  return database.transaction('rw', database.tables, async () => {
    for (const name of TABLE_NAMES) {
      if (name === 'settings') await database.settings.filter((row) => !isDeviceSetting(row.key)).delete();
      else await database.tableOf(name).clear();
    }
  });
}
