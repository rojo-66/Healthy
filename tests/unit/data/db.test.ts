// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { DB_NAME, db, HealthyDb } from '../../../src/lib/data/db';
import { TABLE_NAMES } from '../../../src/lib/data/schemas';
import type { Measurement } from '../../../src/lib/data/schemas/measurements';
import { DB_VERSIONS, latestVersion, type DbVersion } from '../../../src/lib/data/versions';
import { validate } from '../../../src/lib/data/errors';
import { sessionSchema } from '../../../src/lib/data/schemas/sessions';
import measurementsFixture from '../../fixtures/measurements.json';
import sessionFixture from '../../fixtures/session.json';

const opened: HealthyDb[] = [];

function open(name: string, versions: readonly DbVersion[]): HealthyDb {
  const instance = new HealthyDb(name, versions);
  opened.push(instance);
  return instance;
}

afterEach(async () => {
  for (const instance of opened.splice(0)) await instance.delete();
});

describe('database', () => {
  it('si chiama healthy-app e ha tutte le tabelle', async () => {
    expect(DB_NAME).toBe('healthy-app');
    expect(db.name).toBe('healthy-app');
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABLE_NAMES].sort());
    expect(db.verno).toBe(latestVersion());
    expect(await indexedDB.databases()).toContainEqual(expect.objectContaining({ name: 'healthy-app' }));
  });

  it('chiavi primarie e indici previsti', async () => {
    await db.open();
    const schema = Object.fromEntries(
      db.tables.map((t) => [t.name, { key: t.schema.primKey.keyPath, indexes: t.schema.indexes.map((i) => i.name) }]),
    );
    expect(schema).toEqual({
      profile: { key: 'id', indexes: [] },
      measurements: { key: 'id', indexes: ['date'] },
      exercises: { key: 'id', indexes: ['name', 'muscles'] },
      workouts: { key: 'id', indexes: ['updatedAt', 'weekdays'] },
      sessions: { key: 'id', indexes: ['startedAt', '[workoutId+startedAt]'] },
      dietPlans: { key: 'id', indexes: ['validFrom'] },
      dietLog: { key: 'date', indexes: ['planId'] },
      shopping: { key: 'weekStart', indexes: [] },
      settings: { key: 'key', indexes: [] },
    });
    expect(db.exercises.schema.idxByName.muscles?.multi).toBe(true);
    expect(db.workouts.schema.idxByName.weekdays?.multi).toBe(true);
  });
});

describe('migrazioni', () => {
  const v1 = DB_VERSIONS[0]!;

  /** Una versione futura di prova: nuovo indice + trasformazione dei dati già salvati. */
  const v2: DbVersion = {
    version: 2,
    stores: { measurements: 'id, date, weightKg' },
    upgrade: (tx) =>
      tx
        .table<Measurement, string>('measurements')
        .toCollection()
        .modify((m) => {
          if (m.notes === '') m.notes = '(migrata)';
        }),
  };

  async function seedV1(name: string): Promise<void> {
    const old = open(name, [v1]);
    await old.measurements.bulkAdd(measurementsFixture);
    expect(old.verno).toBe(1);
    old.close();
  }

  it('da v1 a v2: dati conservati e trasformati, nuovo indice usabile', async () => {
    await seedV1('migration-ok');

    const next = open('migration-ok', [v1, v2]);
    await next.open();
    expect(next.verno).toBe(2);
    const rows = await next.measurements.orderBy('date').toArray();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(measurementsFixture[0]);
    expect(rows[1]!.notes).toBe('(migrata)');
    expect((await next.measurements.where('weightKg').above(80).toArray()).map((m) => m.date)).toEqual(['2026-08-14']);
  });

  it('v2 vera (M5): le sessioni già salvate ricevono snapshot e live vuoti, valide per lo schema', async () => {
    const old = open('migration-sessions', [v1]);
    await old.table('sessions').add(structuredClone(sessionFixture));
    old.close();

    const next = open('migration-sessions', DB_VERSIONS);
    await next.open();
    expect(next.verno).toBe(2);
    const [row] = await next.sessions.toArray();
    expect(row).toEqual({ ...sessionFixture, snapshot: null, live: null });
    expect(validate(sessionSchema, row).ok).toBe(true);
  });

  it('se la migrazione fallisce il database resta alla versione precedente, dati intatti', async () => {
    await seedV1('migration-fail');

    const broken: DbVersion = {
      ...v2,
      upgrade: async (tx) => {
        await tx.table('measurements').clear();
        throw new Error('migrazione rotta');
      },
    };
    const failing = open('migration-fail', [v1, broken]);
    await expect(failing.open()).rejects.toThrow();
    failing.close();

    const again = open('migration-fail', [v1]);
    await again.open();
    expect(again.verno).toBe(1);
    expect(await again.measurements.toArray()).toEqual(measurementsFixture);
  });
});
