import { Dexie } from 'dexie';
import { db } from '../db';
import type { Run, RunLog } from '../schemas/runs';
import { createTableRepo } from './table-repo';

/** Corse pianificate e fatte (2a). Non si condividono mai: escono dal telefono solo con il backup. */
export const runsRepo = createTableRepo('runs');
export const runLogsRepo = createTableRepo('runLogs');

/** Corse pianificate, in ordine di nome. */
export async function listRuns(): Promise<Run[]> {
  const rows = await db.runs.toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export function saveRun(run: Run): Promise<Run> {
  return runsRepo.put(run);
}

/**
 * Elimina una corsa pianificata. Le corse fatte restano nello storico con il loro nome (`runName`),
 * scollegate (`runId: null`), come le sessioni di una scheda eliminata.
 */
export function deleteRun(id: string): Promise<void> {
  return db.transaction('rw', db.runs, db.runLogs, async () => {
    await db.runs.delete(id);
    await db.runLogs
      .where('[runId+date]')
      .between([id, Dexie.minKey], [id, Dexie.maxKey])
      .modify((log) => {
        log.runId = null;
      });
  });
}

/** Corse fatte, dalla più recente (per data, poi per registrazione). */
export async function listRunLogs(): Promise<RunLog[]> {
  const rows = await db.runLogs.toArray();
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt));
}

export function saveRunLog(log: RunLog): Promise<RunLog> {
  return runLogsRepo.put(log);
}

export function deleteRunLog(id: string): Promise<void> {
  return runLogsRepo.remove(id);
}
