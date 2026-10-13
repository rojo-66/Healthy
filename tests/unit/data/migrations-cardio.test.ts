import { describe, expect, it } from 'vitest';
import { validate } from '../../../src/lib/data/errors';
import {
  backupV1ToV2,
  legacyContentHashV1,
  migrateExerciseRow,
  migrateSavedDraft,
  migrateSessionRow,
  migrateSettingRow,
  migrateWorkoutRow,
  workoutFileV1ToV2,
} from '../../../src/lib/data/migrations/cardio';
import { parseBackup } from '../../../src/lib/data/backup';
import { sessionSchema } from '../../../src/lib/data/schemas/sessions';
import { workoutFileSchema } from '../../../src/lib/data/schemas/workout-file';
import { workoutSchema } from '../../../src/lib/data/schemas/workouts';
import { contentHash } from '../../../src/lib/share/canonical';
import legacyHistory from '../../fixtures/legacy/sessions/history.json';
import legacySession from '../../fixtures/legacy/session.json';
import legacyWorkout from '../../fixtures/legacy/sessions/workout.json';
import legacyShareFile from '../../fixtures/legacy/share/workout-typical.json';
import { validBackupJson } from './helpers';

/**
 * Migrazione 2a (cardio come esercizio): stesse funzioni per database, backup, file condivisi e bozza.
 * Nessun dato perso, idempotenti (una riga già migrata non cambia).
 */

type Raw = Record<string, unknown>;
const workout = (patch: Raw = {}): Raw => ({ ...structuredClone(legacyWorkout), time: null, received: null, previousVersions: [], ...patch });
const items = (row: unknown) => (row as { items: Raw[] }).items;

describe('schede', () => {
  it('il cardio finale diventa l’ultimo esercizio, collegato alla libreria; il resto non cambia', () => {
    const before = workout();
    const after = migrateWorkoutRow(before) as Raw;
    expect(after).not.toHaveProperty('cardio');
    expect(items(after)).toHaveLength(items(before).length + 1);
    expect(items(after).slice(0, -1)).toEqual(items(before).map((i) => ({ kind: 'strength', ...i })));
    expect(items(after).at(-1)).toEqual({
      kind: 'cardio',
      exerciseId: 'cd-tapis-corsa',
      name: 'Tapis roulant · corsa',
      minutes: 12,
      distanceKm: null,
      speedKmh: null,
      inclinePct: null,
      level: null,
      note: '',
      videoUrl: null,
    });
    expect(validate(workoutSchema, after).ok).toBe(true);
  });

  it('senza cardio: solo il tipo agli esercizi', () => {
    const after = migrateWorkoutRow(workout({ cardio: null })) as Raw;
    expect(items(after).every((i) => i.kind === 'strength')).toBe(true);
    expect(items(after)).toHaveLength(items(workout()).length);
    expect(validate(workoutSchema, after).ok).toBe(true);
  });

  it('tipo scritto a mano e sconosciuto: resta il nome, non collegato; 0 minuti conservati', () => {
    const after = migrateWorkoutRow(workout({ cardio: { type: 'Pattinaggio', minutes: 0 } })) as Raw;
    expect(items(after).at(-1)).toMatchObject({ kind: 'cardio', exerciseId: null, name: 'Pattinaggio', minutes: 0 });
    expect(validate(workoutSchema, after).ok).toBe(true);
  });

  it('anche la cronologia (versioni sostituite, M8) viene convertita', () => {
    const after = migrateWorkoutRow(workout({ previousVersions: [workout({ version: 1 })] })) as { previousVersions: Raw[] };
    expect(after.previousVersions[0]).not.toHaveProperty('cardio');
    expect(items(after.previousVersions[0]).at(-1)?.kind).toBe('cardio');
    expect(validate(workoutSchema, after).ok).toBe(true);
  });

  it('impronta della scheda ricevuta: intatta → ricalcolata; modificata qui → invariata', () => {
    const intact = workout({ received: { version: 2, hash: '', at: '2026-10-01T08:00:00.000Z' } });
    (intact.received as Raw).hash = legacyContentHashV1(intact);
    const a = migrateWorkoutRow(intact) as Raw;
    expect((a.received as Raw).hash).toBe(contentHash(a as never));

    const edited = workout({ received: { version: 2, hash: '12345678', at: '2026-10-01T08:00:00.000Z' } });
    const b = migrateWorkoutRow(edited) as Raw;
    expect((b.received as Raw).hash).toBe('12345678');
  });

  it('idempotente: una scheda già migrata non cambia (stesso oggetto)', () => {
    const once = migrateWorkoutRow(workout());
    expect(migrateWorkoutRow(once)).toBe(once);
  });
});

describe('sessioni', () => {
  const zero = { runningSince: null, elapsedMs: 0 };

  it('fatto con km: voce del cardio con minuti e distanza', () => {
    const before = { ...structuredClone(legacyHistory[0]!), cardioDone: { type: 'tapis roulant', minutes: 13.5, distanceKm: 2.1 } };
    const after = migrateSessionRow(before) as { cardio: Raw[]; snapshot: { items: Raw[] } };
    const index = after.snapshot.items.length - 1;
    expect(after.cardio).toEqual([{ itemIndex: index, minutes: 13.5, distanceKm: 2.1, done: true, clock: zero }]);
    expect(after).not.toHaveProperty('cardioDone');
    expect(after.snapshot).not.toHaveProperty('cardio');
    expect(validate(sessionSchema, after).ok).toBe(true);
  });

  it('non fatto: voce vuota; senza cardio nella scheda: nessuna voce', () => {
    const notDone = migrateSessionRow({ ...structuredClone(legacyHistory[0]!), cardioDone: null }) as { cardio: Raw[] };
    expect(notDone.cardio).toEqual([expect.objectContaining({ done: false, minutes: null, distanceKm: null })]);
    const s = structuredClone(legacyHistory[0]!) as Raw;
    s.snapshot = { ...(s.snapshot as Raw), cardio: null };
    s.cardioDone = null;
    const none = migrateSessionRow(s) as Raw;
    expect(none.cardio).toEqual([]);
    expect(validate(sessionSchema, none).ok).toBe(true);
  });

  it('dati incoerenti (fatto ma non previsto): il cardio fatto non si perde', () => {
    const s = structuredClone(legacyHistory[0]!) as Raw;
    s.snapshot = { ...(s.snapshot as Raw), cardio: null };
    s.cardioDone = { type: 'ellittica', minutes: 9.6, distanceKm: null };
    const after = migrateSessionRow(s) as { cardio: Raw[]; snapshot: { items: Raw[] } };
    expect(after.snapshot.items.at(-1)).toMatchObject({ kind: 'cardio', exerciseId: 'cd-ellittica', minutes: 10 });
    expect(after.cardio[0]).toMatchObject({ done: true, minutes: 9.6 });
    expect(validate(sessionSchema, after).ok).toBe(true);
  });

  it('sessione senza copia della scheda (prima di M5): copia ricostruita dalle serie + cardio', () => {
    const after = migrateSessionRow({ ...structuredClone(legacySession), snapshot: null, live: null }) as {
      snapshot: { items: Raw[] };
      cardio: Raw[];
    };
    expect(after.snapshot.items.at(-1)).toMatchObject({ kind: 'cardio' });
    expect(after.cardio).toHaveLength(1);
    expect(validate(sessionSchema, after).ok).toBe(true);
  });

  it('idempotente', () => {
    const once = migrateSessionRow(structuredClone(legacyHistory[2]!));
    expect(migrateSessionRow(once)).toBe(once);
  });
});

describe('esercizi, bozza, impostazioni', () => {
  it('esercizio senza tipo = forza; con tipo invariato', () => {
    const row = { id: 'x', name: 'X', muscles: ['Petto'], equipment: 'Altro', videoUrl: null, custom: true };
    expect(migrateExerciseRow(row)).toEqual({ ...row, kind: 'strength', cardioFields: [] });
    const done = migrateExerciseRow(row);
    expect(migrateExerciseRow(done)).toBe(done);
  });

  it('bozza: il cardio diventa una riga con i campi della voce; altre impostazioni invariate', () => {
    const saved = { savedAt: '2026-10-11T08:00:00.000Z', draft: { items: [], cardio: { type: '', minutes: 10 } } };
    const after = migrateSavedDraft(saved) as { draft: { items: Raw[] } };
    expect(after.draft).not.toHaveProperty('cardio');
    expect(after.draft.items[0]).toMatchObject({ kind: 'cardio', name: '', minutes: 10, fields: [] });
    const other = { key: 'nextMeasurement', value: { text: '', date: null } };
    expect(migrateSettingRow(other)).toBe(other);
  });
});

describe('file e backup', () => {
  it('file scheda v1 → v2 valido per lo schema', () => {
    const v2 = workoutFileV1ToV2(structuredClone(legacyShareFile) as Raw);
    expect(v2.schemaVersion).toBe(2);
    expect(validate(workoutFileSchema, v2).ok).toBe(true);
    expect(items(v2).at(-1)).toMatchObject({ kind: 'cardio', minutes: 12 });
    expect(items(v2).at(-1)).not.toHaveProperty('exerciseId');
  });

  it('backup formato 1 → 2: conteggi e tabelle nuove, poi valido; idempotente sulle righe', () => {
    const v1 = validBackupJson();
    const v2 = backupV1ToV2(v1);
    expect(v2.schemaVersion).toBe(2);
    expect((v2.counts as Raw).runs).toBe(0);
    expect((v2.tables as Raw).runLogs).toEqual([]);
    expect(parseBackup(v1).ok).toBe(true);
    const again = backupV1ToV2({ ...v2, schemaVersion: 1 });
    expect(again.tables).toEqual(v2.tables);
  });
});
