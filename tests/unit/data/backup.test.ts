// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import {
  backupFileName,
  backupToFile,
  buildBackup,
  isBackupStale,
  markBackupDone,
  parseBackup,
  previewBackup,
  readBackupFile,
  restoreBackup,
} from '../../../src/lib/data/backup';
import { BACKUP_MIGRATIONS, type BackupMigrations } from '../../../src/lib/data/backup-migrations';
import { db } from '../../../src/lib/data/db';
import type { Result } from '../../../src/lib/data/errors';
import { MAX_BYTES } from '../../../src/lib/data/limits';
import { latestVersion } from '../../../src/lib/data/versions';
import { clearAll, countAll } from '../../../src/lib/data/repo/maintenance';
import { getSetting, setSetting } from '../../../src/lib/data/repo/settings';
import { primaryKeyOf, TABLE_NAMES, type TableRows } from '../../../src/lib/data/schemas';
import type { Backup } from '../../../src/lib/data/schemas/backup';
import badCounts from '../../fixtures/invalid/backup-bad-counts.json';
import broken from '../../fixtures/invalid/broken.json?raw';
import futureVersion from '../../fixtures/invalid/future-version.json';
import wrongApp from '../../fixtures/invalid/wrong-app.json';
import { clone, fakeFile, resetDb, validBackupJson } from './helpers';

function valid(result: Result<Backup>): Backup {
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

function errorsOf(result: Result<unknown>): string[] {
  if (result.ok) throw new Error('Mi aspettavo un errore');
  return result.errors;
}

const fixture = (): Backup => valid(parseBackup(validBackupJson()));

/** Righe ordinate per chiave primaria, come le restituisce il database. */
function byKey(tables: TableRows): Record<string, unknown[]> {
  return Object.fromEntries(
    TABLE_NAMES.map((name) => [
      name,
      [...tables[name]].sort((a, b) => primaryKeyOf(name, a).localeCompare(primaryKeyOf(name, b), 'en')),
    ]),
  );
}

/** Tutte le righe del database, tabella per tabella. */
async function snapshot(): Promise<Record<string, unknown[]>> {
  return Object.fromEntries(await Promise.all(TABLE_NAMES.map(async (n) => [n, await db.tableOf(n).toArray()])));
}

beforeEach(resetDb);

describe('esporta', () => {
  it('un unico JSON con app, kind, schemaVersion, data e conteggi per tabella', async () => {
    await restoreBackup(fixture());
    const now = new Date('2026-10-11T09:15:00.000Z');
    const backup = await buildBackup(now);
    expect(backup).toMatchObject({
      app: 'healthy-app',
      kind: 'backup',
      schemaVersion: 4,
      createdAt: '2026-10-11T09:15:00.000Z',
      dbVersion: latestVersion(),
      counts: {
        profile: 1,
        measurements: 2,
        exercises: 3,
        workouts: 2,
        sessions: 3,
        runs: 0,
        runLogs: 0,
        calendarEdits: 0,
        dayChoices: 0,
        dietPlans: 1,
        dietLog: 2,
        shopping: 1,
        // 2c: l'inizio del calendario (dal ripristino del backup vecchio).
        settings: 1,
      },
    });
    expect(Object.keys(backup.tables)).toEqual([...TABLE_NAMES]);
  });

  it('nome del file con la data locale', () => {
    expect(backupFileName(new Date(2026, 9, 11, 23, 50))).toBe('healthy-backup-2026-10-11.json');
    expect(backupFileName(new Date(2026, 0, 3, 0, 10))).toBe('healthy-backup-2026-01-03.json');
  });

  it('file JSON pronto da condividere', async () => {
    const backup = await buildBackup();
    const file = backupToFile(backup, new Date(2026, 9, 11));
    expect(file.name).toBe('healthy-backup-2026-10-11.json');
    expect(file.type).toBe('application/json');
    expect(JSON.parse(await file.text())).toEqual(backup);
  });

  it('le impostazioni del telefono non entrano nel backup', async () => {
    await setSetting('lastBackupAt', '2026-10-01T10:00:00.000Z');
    await setSetting('storagePersist', { granted: true, checkedAt: '2026-10-01T10:00:00.000Z' });
    const backup = await buildBackup();
    expect(backup.tables.settings).toEqual([]);
    expect(backup.counts.settings).toBe(0);
  });

  it('markBackupDone salva la data dell’ultimo backup', async () => {
    await markBackupDone(new Date('2026-10-11T09:00:00.000Z'));
    expect(await getSetting('lastBackupAt')).toBe('2026-10-11T09:00:00.000Z');
  });
});

describe('round-trip: esporta → svuota → importa', () => {
  it('restituisce dati identici', async () => {
    await restoreBackup(fixture());
    const before = await buildBackup(new Date('2026-10-11T10:00:00.000Z'));
    const file = backupToFile(before);

    await clearAll();
    expect(Object.values(await countAll()).every((n) => n === 0)).toBe(true);

    const read = valid(await readBackupFile(file));
    await restoreBackup(read);
    const after = await buildBackup(new Date('2026-10-11T10:00:00.000Z'));
    expect(after).toEqual(before);
    // E coincide con la fixture di partenza.
    expect(byKey(after.tables)).toEqual(byKey(fixture().tables));
  });

  it('il ripristino non tocca le impostazioni del telefono', async () => {
    await setSetting('lastBackupAt', '2026-10-01T10:00:00.000Z');
    await restoreBackup(fixture());
    expect(await getSetting('lastBackupAt')).toBe('2026-10-01T10:00:00.000Z');
  });

  it('il ripristino sostituisce i dati, non li somma', async () => {
    await restoreBackup(fixture());
    await restoreBackup(fixture());
    expect(await countAll()).toEqual(fixture().counts);
  });
});

describe('transazione: o tutto o niente', () => {
  it('se una scrittura fallisce a metà, i dati attuali restano intatti', async () => {
    await restoreBackup(fixture());
    const before = await snapshot();

    // Backup valido per zod, ma il database rifiuta le sessioni (dopo aver già svuotato e riscritto altre tabelle).
    const other = fixture();
    other.tables.profile[0]!.name = 'Altro utente';
    other.tables.workouts = [];
    other.counts.workouts = 0;
    const failOnSessions = () => {
      throw new Error('scrittura rifiutata');
    };
    db.sessions.hook('creating', failOnSessions);
    try {
      await expect(restoreBackup(other)).rejects.toThrow();
    } finally {
      db.sessions.hook('creating').unsubscribe(failOnSessions);
    }

    expect(await snapshot()).toEqual(before);
  });

  it('chiavi duplicate che sfuggono alla validazione: rollback', async () => {
    await restoreBackup(fixture());
    const before = await snapshot();
    const duplicated = fixture();
    duplicated.tables.dietLog.push(clone(duplicated.tables.dietLog[0]!));
    await expect(restoreBackup(duplicated)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });
});

describe('importa: validazione', () => {
  it('anteprima con data e conteggi', () => {
    expect(previewBackup(fixture())).toEqual({
      createdAt: '2026-10-11T08:00:00.000Z',
      counts: fixture().counts,
      total: 16,
    });
  });

  it('schemaVersion più nuova: rifiutata con messaggio chiaro', () => {
    expect(errorsOf(parseBackup(futureVersion))).toEqual([
      "Questo file è un backup creato con una versione più recente dell'app (formato 99, questa app legge fino al 4): aggiorna Healthy e riprova.",
    ]);
  });

  it('app sbagliata, tipo sbagliato', () => {
    expect(errorsOf(parseBackup(wrongApp))).toEqual(['Questo file non è stato creato da Healthy.']);
    expect(errorsOf(parseBackup({ ...validBackupJson(), kind: 'workout' }))).toEqual([
      'Questo file è una scheda, non un backup.',
    ]);
  });

  it('conteggi che non tornano (file troncato)', () => {
    expect(errorsOf(parseBackup(badCounts))).toEqual([
      'Sessioni: il backup dichiara 5 righe ma ne contiene 3 (file incompleto?)',
    ]);
  });

  it('chiavi duplicate e più piani attivi', () => {
    const raw = validBackupJson() as { tables: TableRows; counts: Record<string, number> };
    raw.tables.sessions.push(clone(raw.tables.sessions[0]!));
    raw.counts.sessions = 4;
    raw.tables.dietPlans.push({ ...clone(raw.tables.dietPlans[0]!), id: 'altro-piano' });
    raw.counts.dietPlans = 2;
    expect(errorsOf(parseBackup(raw))).toEqual([
      'Sessioni: la chiave «5e551111-1111-4111-8111-111111111111» compare due volte',
      'Piani alimentari: più di un piano risulta attivo',
    ]);
  });

  it('una riga non valida in una tabella → percorso leggibile, nessuna scrittura', async () => {
    const raw = validBackupJson() as { tables: { sessions: { rpe: unknown }[] } };
    raw.tables.sessions[1]!.rpe = 'alto';
    expect(errorsOf(parseBackup(raw))).toEqual(['tabelle › sessioni › n. 2 › RPE: atteso un numero, trovato un testo']);
    expect(await countAll()).toEqual(Object.fromEntries(TABLE_NAMES.map((n) => [n, 0])));
  });

  it('formato vecchio: migrato passo per passo', () => {
    // Formato 0 immaginario: le tabelle stavano in "data".
    const { tables, ...rest } = validBackupJson();
    const old = { ...rest, schemaVersion: 0, data: tables };
    const migrations: BackupMigrations = {
      ...BACKUP_MIGRATIONS,
      0: ({ data, ...v0 }) => ({ ...v0, schemaVersion: 1, tables: data }),
    };
    expect(valid(parseBackup(old, migrations)).tables).toEqual(fixture().tables);
  });

  it('formato vecchio senza migrazione, o migrazione rotta', () => {
    const old = { ...validBackupJson(), schemaVersion: 0 };
    expect(errorsOf(parseBackup(old, {}))).toEqual(['Backup in un formato troppo vecchio (0): non più supportato.']);
    const throwing: BackupMigrations = {
      0: () => {
        throw new Error('x');
      },
    };
    expect(errorsOf(parseBackup(old, throwing))).toEqual(['Impossibile aggiornare il backup dal formato 0.']);
    expect(errorsOf(parseBackup(old, { 0: (v) => v }))).toEqual(['Impossibile aggiornare il backup dal formato 0.']);
  });

  it('file: JSON rotto e dimensione massima', async () => {
    expect(errorsOf(await readBackupFile(fakeFile(broken).file))).toEqual([
      'Il file non è un JSON valido: forse è danneggiato o non è un file di Healthy.',
    ]);
    const { file, text } = fakeFile('{}', MAX_BYTES.backup + 1);
    expect(errorsOf(await readBackupFile(file))).toEqual(['Il file è troppo grande (20 MB): il massimo è 20 MB.']);
    expect(text).not.toHaveBeenCalled();
  });

  it('testo enorme dentro una riga', () => {
    const raw = validBackupJson() as { tables: { measurements: { notes: string }[] } };
    raw.tables.measurements[0]!.notes = 'x'.repeat(5000);
    expect(errorsOf(parseBackup(raw))).toEqual([
      'tabelle › misurazioni › n. 1 › note: testo troppo lungo: massimo 2000 caratteri',
    ]);
  });
});

describe('isBackupStale', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');

  it('mai fatto → da fare', () => {
    expect(isBackupStale(null, now)).toBe(true);
  });

  it('soglia di 14 giorni', () => {
    expect(isBackupStale('2026-10-02T12:00:00.000Z', now)).toBe(false); // 13 giorni
    expect(isBackupStale('2026-10-01T12:00:00.000Z', now)).toBe(false); // 14 giorni esatti
    expect(isBackupStale('2026-10-01T11:59:59.000Z', now)).toBe(true); // appena oltre
    expect(isBackupStale('2026-09-30T12:00:00.000Z', now)).toBe(true); // 15 giorni
  });

  it('data illeggibile → da fare', () => {
    expect(isBackupStale('ieri', now)).toBe(true);
  });
});

describe('2a: backup del formato 1 e corse', () => {
  const run = {
    id: 'corsa-1',
    name: 'Corsa lenta',
    weekdays: [3, 6],
    time: '07:00',
    targetMinutes: 30,
    targetKm: 5,
    note: '',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
  };
  const runLog = {
    id: 'fatta-1',
    runId: 'corsa-1',
    runName: 'Corsa lenta',
    date: '2026-10-10',
    loggedAt: '2026-10-10T08:00:00.000Z',
    durationSec: 1930,
    distanceKm: 5.2,
    rpe: 6,
    note: 'Parco',
  };

  it('un backup del formato 1 (prima del 2a) viene migrato: cardio come esercizio, nessun dato perso', () => {
    const raw = validBackupJson() as { schemaVersion: number; tables: { workouts: { cardio: unknown }[]; sessions: { cardioDone: unknown }[] } };
    expect(raw.schemaVersion).toBe(1);
    const legacyCardio = raw.tables.workouts.filter((w) => w.cardio).length;
    const legacyDone = raw.tables.sessions.filter((s) => s.cardioDone).length;
    const backup = fixture();
    expect(backup.schemaVersion).toBe(4);
    expect(backup.counts.runs).toBe(0);
    expect(backup.tables.runs).toEqual([]);
    expect(backup.tables.workouts.filter((w) => w.items.at(-1)?.kind === 'cardio')).toHaveLength(legacyCardio);
    expect(backup.tables.sessions.filter((s) => s.cardio.some((c) => c.done))).toHaveLength(legacyDone);
    for (const w of backup.tables.workouts) expect(w).not.toHaveProperty('cardio');
    for (const s of backup.tables.sessions) expect(s).not.toHaveProperty('cardioDone');
  });

  it('corse pianificate e fatte entrano nel backup e tornano uguali al ripristino', async () => {
    await restoreBackup(fixture());
    await db.runs.add(run);
    await db.runLogs.add(runLog);
    const backup = await buildBackup();
    expect(backup.counts.runs).toBe(1);
    expect(backup.counts.runLogs).toBe(1);
    const again = valid(parseBackup(JSON.parse(JSON.stringify(backup))));
    await clearAll();
    await restoreBackup(again);
    expect(await db.runs.toArray()).toEqual([run]);
    expect(await db.runLogs.toArray()).toEqual([runLog]);
  });
});
