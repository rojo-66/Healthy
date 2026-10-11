import type { z } from 'zod';
import { db as appDb, type HealthyDb } from '../db';
import { parseOrThrow, ValidationError } from '../errors';
import { PRIMARY_KEYS, TABLE_LABELS, TABLE_SCHEMAS, type TableKey, type TableName, type TableRow } from '../schemas';

/** Dati accettati in scrittura: quelli dello schema prima dei valori predefiniti. */
export type TableInput<T extends TableName> = z.input<(typeof TABLE_SCHEMAS)[T]>;

/** Operazioni di base su una tabella. Ogni scrittura passa dalla validazione zod (errore → `ValidationError`). */
export interface TableRepo<T extends TableName> {
  get(key: TableKey): Promise<TableRow<T> | undefined>;
  list(): Promise<TableRow<T>[]>;
  count(): Promise<number>;
  /** Inserisce; errore se la chiave esiste già. */
  add(row: TableInput<T>): Promise<TableRow<T>>;
  /** Inserisce o sostituisce. */
  put(row: TableInput<T>): Promise<TableRow<T>>;
  /** Modifica alcuni campi di una riga esistente (la chiave non cambia). */
  update(key: TableKey, patch: Partial<TableRow<T>>): Promise<TableRow<T>>;
  remove(key: TableKey): Promise<void>;
}

export function createTableRepo<T extends TableName>(name: T, database: HealthyDb = appDb): TableRepo<T> {
  const table = database.tableOf(name);
  const schema = TABLE_SCHEMAS[name];
  const keyField = PRIMARY_KEYS[name];
  const parse = (row: unknown) => parseOrThrow(schema, row) as TableRow<T>;

  return {
    get: (key) => table.get(key),
    list: () => table.toArray(),
    count: () => table.count(),

    async add(row) {
      const valid = parse(row);
      await table.add(valid);
      return valid;
    },

    async put(row) {
      const valid = parse(row);
      await table.put(valid);
      return valid;
    },

    update(key, patch) {
      return database.transaction('rw', table, async () => {
        const current = await table.get(key);
        if (!current) throw new ValidationError([`${TABLE_LABELS[name]}: elemento «${key}» non trovato`]);
        const next = parse({ ...current, ...patch, [keyField]: key });
        await table.put(next);
        return next;
      });
    },

    remove: (key) => table.delete(key),
  };
}
