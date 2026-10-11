import { vi } from 'vitest';
import { db } from '../../../src/lib/data/db';
import type { FileLike } from '../../../src/lib/data/read-file';
import backupFixture from '../../fixtures/backup-valid.json';

/** Copia profonda di una fixture (i test possono modificarla senza toccare le altre). */
export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Backup finto valido, sempre nuovo. */
export function validBackupJson(): Record<string, unknown> {
  return clone(backupFixture) as Record<string, unknown>;
}

/** File finto: `size` può mentire, per provare i controlli sulla dimensione. */
export function fakeFile(content: string, size = new TextEncoder().encode(content).length) {
  const text = vi.fn(async () => content);
  const file: FileLike = { size, text };
  return { file, text };
}

/** Database vuoto, comprese le impostazioni del telefono. */
export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}
