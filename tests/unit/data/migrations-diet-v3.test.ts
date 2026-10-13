// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { parseBackup } from '../../../src/lib/data/backup';
import { HealthyDb } from '../../../src/lib/data/db';
import { validate } from '../../../src/lib/data/errors';
import {
  backupV2ToV3,
  dietPayloadV2ToV3,
  migrateDietLogRow,
  migrateDietPlanRow,
} from '../../../src/lib/data/migrations/diet-v3';
import { dietLogSchema } from '../../../src/lib/data/schemas/diet-log';
import { dietPlanSchema } from '../../../src/lib/data/schemas/diet-plans';
import { DB_VERSIONS, latestVersion, type DbVersion } from '../../../src/lib/data/versions';
import { buildDayView } from '../../../src/lib/diet/view';
import extendedFixture from '../../fixtures/diet-extended.json';
import { validBackupJson } from './helpers';

/**
 * Migrazione 2b: piani v2 → v3 (una variante per giorno), diario con la fonte dei pasti (ex scambio).
 * Stesse funzioni per database (v8), backup (formato 2 → 3) e file. Nessun dato perso, idempotenti.
 */

type Raw = Record<string, unknown>;

/** Piano come era salvato prima del 2b (payload v2). */
function legacyPlan(patch: Raw = {}): Raw {
  const { app: _a, kind: _k, schemaVersion: _s, ...payload } = structuredClone(extendedFixture) as unknown as Raw;
  return {
    id: 'piano-v2',
    version: 1,
    title: 'Piano v2',
    author: '',
    validFrom: null,
    active: true,
    archived: false,
    importedAt: '2026-10-01T08:00:00.000Z',
    origin: 'file',
    payload: { generalNotes: '', ...payload },
    ...patch,
  };
}

describe('funzioni di migrazione', () => {
  it('piano v2 → v3: ogni giorno una variante con tipo, nota, integratori e pasti di prima', () => {
    const before = legacyPlan();
    const after = migrateDietPlanRow(before) as { payload: { days: Raw[] } };
    const oldDays = (before.payload as { days: Raw[] }).days;
    after.payload.days.forEach((day, i) => {
      const old = oldDays[i]!;
      expect(day).toEqual({
        weekday: old.weekday,
        defaultType: old.type ?? null,
        variants: [{ type: old.type ?? null, ...(old.note !== undefined ? { note: old.note } : {}), ...(old.supplements !== undefined ? { supplements: old.supplements } : {}), meals: old.meals }],
      });
    });
    expect(validate(dietPlanSchema, after).ok).toBe(true);
  });

  it('anche i piani archiviati; idempotente (un piano già v3 non cambia)', () => {
    const archived = migrateDietPlanRow(legacyPlan({ id: 'vecchio', active: false, archived: true }));
    expect(validate(dietPlanSchema, archived).ok).toBe(true);
    expect(migrateDietPlanRow(archived)).toBe(archived);
    expect(dietPayloadV2ToV3({ days: [] })).toEqual({ days: [] });
  });

  it('diario: lo scambio diventa la fonte dei pasti (variante predefinita), senza scambio null; idempotente', () => {
    const swapped = migrateDietLogRow({ date: '2026-10-12', planId: 'p', swappedFromWeekday: 3, eaten: { pranzo: true } });
    expect(swapped).toEqual({ date: '2026-10-12', planId: 'p', mealsFrom: { weekday: 3, type: null }, eaten: { pranzo: true } });
    expect(validate(dietLogSchema, swapped).ok).toBe(true);
    expect(migrateDietLogRow({ date: '2026-10-11', planId: 'p', swappedFromWeekday: null, eaten: {} })).toEqual({
      date: '2026-10-11',
      planId: 'p',
      mealsFrom: null,
      eaten: {},
    });
    expect(migrateDietLogRow(swapped)).toBe(swapped);
  });

  it('lo scambio migrato mostra gli stessi pasti di prima (il giorno seguito)', () => {
    const plan = dietPlanSchema.parse(migrateDietPlanRow(legacyPlan()));
    const log = dietLogSchema.parse(migrateDietLogRow({ date: '2026-10-12', planId: 'piano-v2', swappedFromWeekday: 3, eaten: {} }));
    const today = buildDayView(plan.payload, 1, { today: true, eaten: {}, nowMinutes: 600, mealsFrom: log.mealsFrom });
    const wednesday = buildDayView(plan.payload, 3, { today: true, eaten: {}, nowMinutes: 600 });
    expect(today?.meals.map((m) => [m.key, m.name])).toEqual(wednesday?.meals.map((m) => [m.key, m.name]));
    expect(today?.plan.total.kcal).toBeCloseTo(wednesday!.plan.total.kcal);
  });

  it('backup formato 2 → 3, e 1 → 2 → 3 dal file di prova', () => {
    const v1 = validBackupJson();
    const parsed = parseBackup(v1);
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    expect(parsed.value.schemaVersion).toBe(4);
    for (const plan of parsed.value.tables.dietPlans) expect(plan.payload.days.every((d) => d.variants.length === 1)).toBe(true);
    for (const log of parsed.value.tables.dietLog) expect(log).not.toHaveProperty('swappedFromWeekday');

    const v2 = { ...v1, schemaVersion: 2 };
    const v3 = backupV2ToV3(v2);
    expect(v3.schemaVersion).toBe(3);
  });
});

describe('database v7 → v8', () => {
  const opened: HealthyDb[] = [];
  const open = (name: string, versions: readonly DbVersion[]) => {
    const db = new HealthyDb(name, versions);
    opened.push(db);
    return db;
  };
  afterEach(async () => {
    for (const db of opened.splice(0)) await db.delete();
  });

  it('piani (anche archiviati) con le varianti, diario con la fonte dei pasti; validi per lo schema', async () => {
    const old = open('v8-diet', DB_VERSIONS.slice(0, 7));
    await old.table('dietPlans').bulkAdd([legacyPlan(), legacyPlan({ id: 'vecchio', active: false, archived: true })]);
    await old.table('dietLog').bulkAdd([
      { date: '2026-10-12', planId: 'piano-v2', swappedFromWeekday: 3, eaten: { colazione: true } },
      { date: '2026-10-11', planId: 'piano-v2', swappedFromWeekday: null, eaten: {} },
    ]);
    old.close();

    const next = open('v8-diet', DB_VERSIONS);
    await next.open();
    expect(next.verno).toBe(latestVersion());
    for (const plan of await next.dietPlans.toArray()) {
      expect(validate(dietPlanSchema, plan).ok).toBe(true);
      expect(plan.payload.days.every((d) => d.variants.length === 1)).toBe(true);
    }
    const logs = await next.dietLog.orderBy('date').toArray();
    expect(logs.map((l) => l.mealsFrom)).toEqual([null, { weekday: 3, type: null }]);
    expect(logs[1]!.eaten).toEqual({ colazione: true });
  });

  it('se la v8 fallisce resta la v7 con i dati di prima', async () => {
    const old = open('v8-fail', DB_VERSIONS.slice(0, 7));
    await old.table('dietPlans').add(legacyPlan());
    old.close();
    const v8 = DB_VERSIONS[7]!;
    const broken: DbVersion = {
      ...v8,
      upgrade: async (tx) => {
        await v8.upgrade?.(tx);
        throw new Error('migrazione rotta');
      },
    };
    const failing = open('v8-fail', [...DB_VERSIONS.slice(0, 7), broken]);
    await expect(failing.open()).rejects.toThrow();
    failing.close();
    const again = open('v8-fail', DB_VERSIONS.slice(0, 7));
    await again.open();
    expect(again.verno).toBe(7);
    expect(await again.table('dietPlans').toArray()).toEqual([legacyPlan()]);
  });
});
