import type { z } from 'zod';
import { dietLogSchema } from './diet-log';
import { dietPlanSchema } from './diet-plans';
import { exerciseSchema } from './exercises';
import { measurementSchema } from './measurements';
import { profileSchema } from './profile';
import { sessionSchema } from './sessions';
import { settingSchema } from './settings';
import { shoppingSchema } from './shopping';
import { workoutSchema } from './workouts';

/** Tabelle del database, nell'ordine in cui compaiono nel backup e nella pagina tecnica. */
export const TABLE_NAMES = [
  'profile',
  'measurements',
  'exercises',
  'workouts',
  'sessions',
  'dietPlans',
  'dietLog',
  'shopping',
  'settings',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

/** Schema zod di una riga per ogni tabella: ogni scrittura passa da qui. */
export const TABLE_SCHEMAS = {
  profile: profileSchema,
  measurements: measurementSchema,
  exercises: exerciseSchema,
  workouts: workoutSchema,
  sessions: sessionSchema,
  dietPlans: dietPlanSchema,
  dietLog: dietLogSchema,
  shopping: shoppingSchema,
  settings: settingSchema,
} as const satisfies Record<TableName, z.ZodType>;

export type TableRow<T extends TableName> = z.output<(typeof TABLE_SCHEMAS)[T]>;
export type TableRows = { [T in TableName]: TableRow<T>[] };

/** Chiave primaria di ogni tabella (vedi `versions.ts`). */
export const PRIMARY_KEYS = {
  profile: 'id',
  measurements: 'id',
  exercises: 'id',
  workouts: 'id',
  sessions: 'id',
  dietPlans: 'id',
  dietLog: 'date',
  shopping: 'weekStart',
  settings: 'key',
} as const satisfies { [T in TableName]: keyof TableRow<T> & string };

/** Tutte le chiavi primarie sono stringhe (UUID, slug, date `AAAA-MM-GG`, nomi di impostazioni). */
export type TableKey = string;

/** Nomi italiani delle tabelle (anteprima del backup, pagina tecnica, messaggi). */
export const TABLE_LABELS: Readonly<Record<TableName, string>> = {
  profile: 'Profilo',
  measurements: 'Misurazioni',
  exercises: 'Esercizi',
  workouts: 'Schede',
  sessions: 'Sessioni',
  dietPlans: 'Piani alimentari',
  dietLog: 'Diario dieta',
  shopping: 'Spesa',
  settings: 'Impostazioni',
};

export function primaryKeyOf<T extends TableName>(table: T, row: TableRow<T>): TableKey {
  return String((row as Record<string, unknown>)[PRIMARY_KEYS[table]]);
}
