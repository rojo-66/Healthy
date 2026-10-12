import { z } from 'zod';
import { MAX_TEXT } from '../limits';
import { isoDate, isoDateTime, text } from './common';
import { savedDraftSchema, workoutAuthorSchema } from './workout-draft';

/** Impostazioni: una riga per chiave, ogni chiave ha il suo tipo di valore. */
export const settingSchema = z.discriminatedUnion('key', [
  /** Ultimo backup consegnato (condiviso o scaricato). */
  z.object({ key: z.literal('lastBackupAt'), value: isoDateTime }),
  /** Esito di `navigator.storage.persist()` all'ultimo avvio. */
  z.object({
    key: z.literal('storagePersist'),
    value: z.object({ granted: z.boolean(), checkedAt: isoDateTime }),
  }),
  /** Chi crea le schede: il mio nome come PT e l'origine predefinita delle nuove schede (nel Profilo, M7). */
  z.object({ key: z.literal('workoutAuthor'), value: workoutAuthorSchema }),
  /** Bozza dell'editor schede non ancora salvata (una sola). */
  z.object({ key: z.literal('workoutDraft'), value: savedDraftSchema }),
  /** Condizioni per la prossima bioimpedenza, scritte dall'utente, con una data facoltativa (M7). */
  z.object({
    key: z.literal('nextMeasurement'),
    value: z.object({ text: text(MAX_TEXT.note), date: isoDate.nullable() }),
  }),
]);

export type Setting = z.infer<typeof settingSchema>;
export type SettingKey = Setting['key'];
export type SettingValues = { [S in Setting as S['key']]: S['value'] };
export type SettingValue<K extends SettingKey> = SettingValues[K];

/**
 * Chiavi che descrivono questo telefono, non i dati: non entrano nel backup
 * e non vengono toccate da "Svuota tutto" né dal ripristino.
 */
export const DEVICE_SETTING_KEYS: readonly SettingKey[] = ['lastBackupAt', 'storagePersist'];

export function isDeviceSetting(key: string): boolean {
  return (DEVICE_SETTING_KEYS as readonly string[]).includes(key);
}
