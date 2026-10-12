import { parseBackup } from '../../../src/lib/data/backup';
import type { Backup } from '../../../src/lib/data/schemas/backup';
import backupProgress from '../../fixtures/progress/backup-progress.json';

/** Oggi nei test di Progressi: lunedì 12 ottobre 2026 (come la fixture e gli e2e). */
export const TODAY = '2026-10-12';

/** Tabelle del backup finto di Progressi (3 mesi di dati inventati), validate con lo schema del backup. */
export function progressTables(): Backup['tables'] {
  const result = parseBackup(structuredClone(backupProgress));
  if (!result.ok) throw new Error(`fixture non valida: ${result.errors.join('; ')}`);
  return result.value.tables;
}
