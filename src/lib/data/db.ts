import { Dexie, type Table } from 'dexie';
import type { TableKey, TableName, TableRow } from './schemas';
import { applyVersions, DB_VERSIONS, type DbVersion } from './versions';

/**
 * Nome del database IndexedDB. Obbligatorio e fisso: MyDiet vive sulla stessa origine
 * (`rojo-66.github.io`) con il suo database, che non va mai toccato.
 */
export const DB_NAME = 'healthy-app';

export type HealthyTable<T extends TableName> = Table<TableRow<T>, TableKey>;

export class HealthyDb extends Dexie {
  declare profile: HealthyTable<'profile'>;
  declare measurements: HealthyTable<'measurements'>;
  declare exercises: HealthyTable<'exercises'>;
  declare workouts: HealthyTable<'workouts'>;
  declare sessions: HealthyTable<'sessions'>;
  declare runs: HealthyTable<'runs'>;
  declare runLogs: HealthyTable<'runLogs'>;
  declare calendarEdits: HealthyTable<'calendarEdits'>;
  declare dayChoices: HealthyTable<'dayChoices'>;
  declare dietPlans: HealthyTable<'dietPlans'>;
  declare dietLog: HealthyTable<'dietLog'>;
  declare shopping: HealthyTable<'shopping'>;
  declare settings: HealthyTable<'settings'>;

  /** `name` e `versions` diversi servono solo ai test (migrazioni, database isolati). */
  constructor(name: string = DB_NAME, versions: readonly DbVersion[] = DB_VERSIONS) {
    super(name);
    applyVersions(this, versions);
  }

  /** Tabella per nome, con il suo tipo. */
  tableOf<T extends TableName>(name: T): HealthyTable<T> {
    return this.table(name) as HealthyTable<T>;
  }
}

/** Il database dell'app. Si apre da solo alla prima query. */
export const db = new HealthyDb();
