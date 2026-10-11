import { db } from '../db';
import type { SettingKey, SettingValue } from '../schemas/settings';
import { createTableRepo } from './table-repo';

export const settingsRepo = createTableRepo('settings');

/** Valore di un'impostazione, con il suo tipo; `null` se non è mai stata salvata. */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K> | null> {
  const row = await db.settings.get(key);
  return row ? (row.value as SettingValue<K>) : null;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
  await settingsRepo.put({ key, value } as Parameters<typeof settingsRepo.put>[0]);
}
