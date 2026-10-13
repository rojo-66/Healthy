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
import { exerciseSchema } from '../../../src/lib/data/schemas/exercises';
import { settingSchema } from '../../../src/lib/data/schemas/settings';
import { legacyContentHashV1, migrateSessionRow, migrateWorkoutRow } from '../../../src/lib/data/migrations/cardio';
import { contentHash } from '../../../src/lib/share/canonical';
import { migrateDietPlanRow } from '../../../src/lib/data/migrations/diet-v3';
import { isLocallyEdited } from '../../../src/lib/share/import/workout';
import measurementsFixture from '../../fixtures/measurements.json';
// Le migrazioni vecchie partono dai dati com'erano prima del 2a (cardio finale, `cardioDone`).
import sessionFixture from '../../fixtures/legacy/session.json';
import workoutFixture from '../../fixtures/legacy/sessions/workout.json';
import historyFixture from '../../fixtures/legacy/sessions/history.json';
import inProgressFixture from '../../fixtures/legacy/sessions/in-progress.json';

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
      runs: { key: 'id', indexes: ['updatedAt', 'weekdays'] },
      runLogs: { key: 'id', indexes: ['date', '[runId+date]'] },
      calendarEdits: { key: 'key', indexes: ['originalDate', 'toDate'] },
      dayChoices: { key: 'date', indexes: [] },
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
    // Valida per lo schema di oggi dopo la migrazione del 2a.
    expect(validate(sessionSchema, migrateSessionRow(row)).ok).toBe(true);
  });

  it('v3 vera (M6): le schede già salvate ricevono un orario vuoto, valide per lo schema', async () => {
    const old = open('migration-workouts', DB_VERSIONS.slice(0, 2));
    const stored = structuredClone(workoutFixture) as Record<string, unknown>;
    await old.table('workouts').add(stored);
    old.close();

    const next = open('migration-workouts', DB_VERSIONS.slice(0, 3));
    await next.open();
    expect(next.verno).toBe(3);
    const [row] = await next.workouts.toArray();
    expect(row).toEqual({ ...stored, time: null });
    expect(validate(workoutSchema, migrateWorkoutRow(row)).ok).toBe(true);
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
    const stored = { ...structuredClone(workoutFixture), time: null };
    await old.table('workouts').add(stored);
    old.close();

    const next = open('migration-received', DB_VERSIONS.slice(0, 5));
    await next.open();
    expect(next.verno).toBe(5);
    const [row] = await next.workouts.toArray();
    expect(row).toEqual({ ...stored, received: null, previousVersions: [] });
    expect(validate(workoutSchema, migrateWorkoutRow(row)).ok).toBe(true);
  });

  it('v6 vera (modello per Claude): i piani già salvati hanno le indicazioni generali vuote, validi per lo schema', async () => {
    const old = open('migration-general-notes', DB_VERSIONS.slice(0, 5));
    // Piano come era salvato prima (formato v2, senza indicazioni generali).
    const oldPayload = { dayTypes: {}, categories: [], products: {}, days: [{ weekday: 1, type: null, note: '', supplements: [], meals: [] }], recipes: [] };
    const plan = {
      id: 'piano-vecchio',
      version: 1,
      title: 'Piano di prova',
      author: '',
      validFrom: null,
      active: true,
      archived: false,
      importedAt: '2026-10-01T08:00:00.000Z',
      origin: 'file',
      payload: oldPayload,
    };
    await old.table('dietPlans').add(structuredClone(plan));
    old.close();

    const next = open('migration-general-notes', DB_VERSIONS.slice(0, 6));
    await next.open();
    expect(next.verno).toBe(6);
    const [row] = await next.dietPlans.toArray();
    expect(row).toEqual({ ...plan, payload: { ...oldPayload, generalNotes: '' } });
    expect(validate(dietPlanSchema, migrateDietPlanRow(row)).ok).toBe(true);
  });

  describe('v7 vera (2a): cardio come esercizio, corse', () => {
    const legacyWorkout = () => ({
      ...structuredClone(workoutFixture),
      time: '18:00',
      received: null,
      previousVersions: [{ ...structuredClone(workoutFixture), version: 2, time: null, received: null }],
    });

    async function seedV6(name: string, seed: (db: HealthyDb) => Promise<unknown>): Promise<void> {
      const old = open(name, DB_VERSIONS.slice(0, 6));
      await seed(old);
      expect(old.verno).toBe(6);
      old.close();
    }

    it('schede: il cardio finale diventa l’ultimo esercizio (anche nella cronologia), valide per lo schema', async () => {
      await seedV6('v7-workouts', (old) => old.table('workouts').add(legacyWorkout()));
      const next = open('v7-workouts', DB_VERSIONS);
      await next.open();
      expect(next.verno).toBe(latestVersion());
      const [row] = await next.workouts.toArray();
      expect(validate(workoutSchema, row).ok).toBe(true);
      expect(row).not.toHaveProperty('cardio');
      const kinds = row!.items.map((i) => i.kind);
      expect(kinds.at(-1)).toBe('cardio');
      expect(kinds.slice(0, -1).every((k) => k === 'strength')).toBe(true);
      expect(row!.items.at(-1)).toEqual({
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
      expect(row!.previousVersions[0]!.items.at(-1)?.kind).toBe('cardio');
      // Il resto non cambia.
      expect(row!.items.length).toBe(workoutFixture.items.length + 1);
      expect(row!.time).toBe('18:00');
    });

    it('scheda ricevuta intatta resta intatta; modificata qui resta modificata', async () => {
      const intact = { ...legacyWorkout(), id: 'ricevuta-intatta' };
      const intactHash = legacyContentHashV1(intact);
      const edited = { ...legacyWorkout(), id: 'ricevuta-modificata' };
      await seedV6('v7-received', async (old) => {
        await old.table('workouts').add({ ...intact, received: { version: intact.version, hash: intactHash, at: '2026-10-01T08:00:00.000Z' } });
        await old.table('workouts').add({ ...edited, received: { version: edited.version, hash: '0badc0de', at: '2026-10-01T08:00:00.000Z' } });
      });
      const next = open('v7-received', DB_VERSIONS);
      await next.open();
      const a = (await next.workouts.get('ricevuta-intatta'))!;
      const b = (await next.workouts.get('ricevuta-modificata'))!;
      expect(a.received?.hash).toBe(contentHash(a));
      expect(isLocallyEdited(a)).toBe(false);
      expect(b.received?.hash).toBe('0badc0de');
      expect(isLocallyEdited(b)).toBe(true);
    });

    it('sessioni: cardioDone diventa la voce del cardio (fatto, non fatto, senza copia della scheda, in corso)', async () => {
      const done = { ...structuredClone(historyFixture[0]!), cardioDone: { type: 'tapis roulant', minutes: 14, distanceKm: 2.3 } };
      const notDone = { ...structuredClone(historyFixture[1]!), cardioDone: null };
      const noSnapshot = { ...structuredClone(sessionFixture), snapshot: null, live: null };
      const live = structuredClone(inProgressFixture);
      await seedV6('v7-sessions', (old) => old.table('sessions').bulkAdd([done, notDone, noSnapshot, live]));
      const next = open('v7-sessions', DB_VERSIONS);
      await next.open();
      const rows = new Map((await next.sessions.toArray()).map((s) => [s.id, s]));
      for (const row of rows.values()) {
        expect(validate(sessionSchema, row).ok, row.id).toBe(true);
        expect(row).not.toHaveProperty('cardioDone');
      }

      const a = rows.get(done.id)!;
      const ai = a.snapshot!.items.length - 1;
      expect(a.snapshot!.items[ai]).toMatchObject({ kind: 'cardio', name: 'Tapis roulant · corsa', minutes: 12 });
      expect(a.cardio).toEqual([{ itemIndex: ai, minutes: 14, distanceKm: 2.3, done: true, clock: { runningSince: null, elapsedMs: 0 } }]);
      expect(a.sets).toEqual(done.sets);

      const b = rows.get(notDone.id)!;
      expect(b.cardio).toEqual([
        { itemIndex: b.snapshot!.items.length - 1, minutes: null, distanceKm: null, done: false, clock: { runningSince: null, elapsedMs: 0 } },
      ]);

      // Prima di M5 la sessione non aveva la copia della scheda: si ricostruisce dalle serie, come `sessionItems()`.
      const c = rows.get(noSnapshot.id)!;
      expect(c.snapshot!.items.at(-1)).toMatchObject({ kind: 'cardio', name: 'Tapis roulant · corsa' });
      expect(c.cardio[0]).toMatchObject({ done: true, minutes: 12 });
      expect(c.snapshot!.items[0]).toMatchObject({ kind: 'strength', name: 'Esercizio 1' });

      // Sessione in corso: l'esercizio mostrato non cambia (il cardio va in fondo).
      const d = rows.get(live.id)!;
      expect(d.live).toEqual(live.live);
      expect(d.endedAt).toBeNull();
    });

    it('esercizi personalizzati: tipo forza; bozza dell’editor: il cardio diventa una riga; tabelle nuove vuote', async () => {
      const custom = { id: 'mio-esercizio', name: 'Crunch alla macchina', muscles: ['Addominali'], equipment: 'Macchina', videoUrl: null, custom: true };
      const draft = {
        key: 'workoutDraft',
        value: {
          savedAt: '2026-10-11T08:00:00.000Z',
          draft: {
            workoutId: 'bozza-1',
            baseVersion: null,
            source: 'own',
            author: '',
            name: 'Bozza',
            weekdays: [2],
            time: null,
            intro: '',
            warmup: [],
            items: [
              {
                key: 'k1',
                exerciseId: null,
                name: 'Panca',
                muscles: ['Petto'],
                sets: 3,
                reps: 10,
                kg: 40,
                restSec: 90,
                note: '',
                videoUrl: '',
                setsDetail: null,
                setsDetailMemory: null,
              },
            ],
            cardio: { type: 'cyclette', minutes: 15 },
          },
        },
      };
      await seedV6('v7-misc', async (old) => {
        await old.table('exercises').add(custom);
        await old.table('settings').add(draft);
      });
      const next = open('v7-misc', DB_VERSIONS);
      await next.open();
      const ex = await next.exercises.get('mio-esercizio');
      expect(ex).toEqual({ ...custom, kind: 'strength', cardioFields: [] });
      expect(validate(exerciseSchema, ex).ok).toBe(true);
      const setting = await next.settings.get('workoutDraft');
      expect(validate(settingSchema, setting).ok).toBe(true);
      const items = setting?.key === 'workoutDraft' ? setting.value.draft.items : [];
      expect(items.map((i) => i.kind)).toEqual(['strength', 'cardio']);
      expect(items[1]).toMatchObject({ kind: 'cardio', exerciseId: 'cd-cyclette', name: 'Cyclette', minutes: 15, fields: ['distance', 'level'] });
      expect(await next.runs.count()).toBe(0);
      expect(await next.runLogs.count()).toBe(0);
    });

    it('se la v7 fallisce il database resta alla v6 con i dati di prima', async () => {
      await seedV6('v7-fail', (old) => old.table('workouts').add(legacyWorkout()));
      const v7 = DB_VERSIONS[6]!;
      const broken: DbVersion = {
        ...v7,
        upgrade: async (tx) => {
          await v7.upgrade?.(tx);
          throw new Error('migrazione rotta');
        },
      };
      const failing = open('v7-fail', [...DB_VERSIONS.slice(0, 6), broken]);
      await expect(failing.open()).rejects.toThrow();
      failing.close();

      const again = open('v7-fail', DB_VERSIONS.slice(0, 6));
      await again.open();
      expect(again.verno).toBe(6);
      expect(await again.table('workouts').toArray()).toEqual([legacyWorkout()]);
    });
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
