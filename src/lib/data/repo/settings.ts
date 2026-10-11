import { db } from '../db';
import { nowIso } from '../ids';
import type { SettingKey, SettingValue } from '../schemas/settings';
import type { SavedDraft, WorkoutAuthor, WorkoutDraft } from '../schemas/workout-draft';
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

// --- Editor schede (M4) ---

export const DEFAULT_WORKOUT_AUTHOR: WorkoutAuthor = { name: '', lastSource: 'own' };

/** Chi crea le schede (nome del PT, origine predefinita). */
export async function getWorkoutAuthor(): Promise<WorkoutAuthor> {
  return (await getSetting('workoutAuthor')) ?? DEFAULT_WORKOUT_AUTHOR;
}

export function setWorkoutAuthor(author: WorkoutAuthor): Promise<void> {
  return setSetting('workoutAuthor', { name: author.name.trim(), lastSource: author.lastSource });
}

/** Bozza non salvata dell'editor (una sola). */
export function getWorkoutDraft(): Promise<SavedDraft | null> {
  return getSetting('workoutDraft');
}

export function saveWorkoutDraft(draft: WorkoutDraft, now: Date = new Date()): Promise<void> {
  return setSetting('workoutDraft', { savedAt: nowIso(now), draft });
}

export async function clearWorkoutDraft(): Promise<void> {
  await db.settings.delete('workoutDraft');
}
