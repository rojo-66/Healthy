// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { DB_NAME, db, HealthyDb } from '../../../src/lib/data/db';
import { TABLE_NAMES } from '../../../src/lib/data/schemas';
import type { Measurement } from '../../../src/lib/data/schemas/measurements';
import { DB_VERSIONS, latestVersion, type DbVersion } from '../../../src/lib/data/versions';
import { validate } from '../../../src/lib/data/errors';
import { dietPlanSchema } from '../../../src/lib/data/schemas/diet-plans';
import { profileSchema } from '../../../src/lib/data/schemas/profile';
import { sessionSchema } from '../../../src/lib/data/schemas/sessions';
import { workoutSchema } from '../../../src/lib/data/schemas/workouts';
import measurementsFixture from '../../fixtures/measurements.json';
import sessionFixture from '../../fixtures/session.json';
import workoutFixture from '../../fixtures/sessions/workout.json';

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

    const next = open('migration-sessions', DB_VERSIONS.slice(0, 2));
    await next.open();
    expect(next.verno).toBe(2);
    const [row] = await next.sessions.toArray();
    expect(row).toEqual({ ...sessionFixture, snapshot: null, live: null });
    expect(validate(sessionSchema, row).ok).toBe(true);
  });

  it('v3 vera (M6): le schede già salvate ricevono un orario vuoto, valide per lo schema', async () => {
    const old = open('migration-workouts', DB_VERSIONS.slice(0, 2));
    const { time: _none, ...stored } = workoutSchema.parse(structuredClone(workoutFixture));
    await old.table('workouts').add(stored);
    old.close();

    const next = open('migration-workouts', DB_VERSIONS.slice(0, 3));
    await next.open();
    expect(next.verno).toBe(3);
    const [row] = await next.workouts.toArray();
    expect(row).toEqual({ ...stored, time: null });
    expect(validate(workoutSchema, row).ok).toBe(true);
  });

  it('v4 vera (M7): il profilo già salvato riceve il livello di attività sedentario, valido per lo schema', async () => {
    const old = open('migration-profile', DB_VERSIONS.slice(0, 3));
    const stored = { id: 'me', name: 'Prova', birthYear: 1990, sex: 'F', heightCm: 165, goal: 'lose' };
    await old.table('profile').add(structuredClone(stored));
    old.close();

    const next = open('migration-profile', DB_VERSIONS.slice(0, 4));
    await next.open();
    expect(next.verno).toBe(4);
    const [row] = await next.profile.toArray();
    expect(row).toEqual({ ...stored, activityLevel: 'sedentary' });
    expect(validate(profileSchema, row).ok).toBe(true);
  });

  it('v5 vera (M8): le schede già salvate non risultano ricevute e non hanno cronologia, valide per lo schema', async () => {
    const old = open('migration-received', DB_VERSIONS.slice(0, 4));
    const { received: _r, previousVersions: _p, ...stored } = workoutSchema.parse(structuredClone(workoutFixture));
    await old.table('workouts').add(stored);
    old.close();

    const next = open('migration-received', DB_VERSIONS.slice(0, 5));
    await next.open();
    expect(next.verno).toBe(5);
    const [row] = await next.workouts.toArray();
    expect(row).toEqual({ ...stored, received: null, previousVersions: [] });
    expect(validate(workoutSchema, row).ok).toBe(true);
  });

  it('v6 vera (modello per Claude): i piani già salvati hanno le indicazioni generali vuote, validi per lo schema', async () => {
    const old = open('migration-general-notes', DB_VERSIONS.slice(0, 5));
    const plan = dietPlanSchema.parse({
      id: 'piano-vecchio',
      version: 1,
      title: 'Piano di prova',
      author: '',
      validFrom: null,
      active: true,
      archived: false,
      importedAt: '2026-10-01T08:00:00.000Z',
      origin: 'file',
      payload: { products: {}, days: [{ weekday: 1, meals: [] }] },
    });
    const { generalNotes: _g, ...oldPayload } = plan.payload;
    await old.table('dietPlans').add({ ...plan, payload: oldPayload });
    old.close();

    const next = open('migration-general-notes', DB_VERSIONS);
    await next.open();
    expect(next.verno).toBe(6);
    const [row] = await next.dietPlans.toArray();
    expect(row).toEqual(plan);
    expect(row?.payload.generalNotes).toBe('');
    expect(validate(dietPlanSchema, row).ok).toBe(true);
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
