// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBackup, parseBackup, restoreBackup } from '../../../src/lib/data/backup';
import { db, HealthyDb } from '../../../src/lib/data/db';
import { validate, ValidationError } from '../../../src/lib/data/errors';
import { backupV3ToV4, migrateDietLogRowV4 } from '../../../src/lib/data/migrations/calendar-v4';
import { migrateDietPlanRow } from '../../../src/lib/data/migrations/diet-v3';
import { applyCalendarChange, getCalendarStart, listCalendarEdits, listDayChoices, setDayChoice, undoCalendarChange } from '../../../src/lib/data/repo/calendar';
import { calendarEditSchema } from '../../../src/lib/data/schemas/calendar';
import { dietLogSchema } from '../../../src/lib/data/schemas/diet-log';
import { dietPlanSchema } from '../../../src/lib/data/schemas/diet-plans';
import { DB_VERSIONS, latestVersion, type DbVersion } from '../../../src/lib/data/versions';
import { buildDayView } from '../../../src/lib/diet/view';
import extendedFixture from '../../fixtures/diet-extended.json';
import { move, skip } from '../calendar/helpers';
import { resetDb, validBackupJson } from './helpers';

/**
 * Migrazione 2c: tabelle del calendario, fonte dei pasti segnati nel diario, inizio del calendario.
 * Stesse funzioni per database (v9) e backup (formato 3 → 4). Nessun dato perso, idempotenti.
 */

type Raw = Record<string, unknown>;

const plan = () =>
  dietPlanSchema.parse(
    migrateDietPlanRow({
      id: 'piano',
      version: 1,
      title: 'Piano',
      author: '',
      validFrom: null,
      active: true,
      archived: false,
      importedAt: '2026-10-01T08:00:00.000Z',
      origin: 'file',
      payload: (({ app: _a, kind: _k, schemaVersion: _s, ...rest }) => ({ generalNotes: '', ...rest }))(structuredClone(extendedFixture) as Raw),
    }),
  );

describe('funzioni di migrazione', () => {
  it('diario: ogni pasto segnato riceve la fonte di prima (scambio o variante predefinita del giorno); idempotente', () => {
    const swapped = migrateDietLogRowV4({ date: '2026-10-12', planId: 'p', mealsFrom: { weekday: 3, type: null }, eaten: { pranzo: true, cena: false } });
    expect(swapped).toEqual({
      date: '2026-10-12',
      planId: 'p',
      mealsFrom: { weekday: 3, type: null },
      eaten: { pranzo: true, cena: false },
      mealSources: { pranzo: { weekday: 3, type: null } },
    });
    const plain = migrateDietLogRowV4({ date: '2026-10-11', planId: 'p', mealsFrom: null, eaten: { colazione: true } });
    expect((plain as Raw).mealSources).toEqual({ colazione: { weekday: 7, type: null } });
    expect(validate(dietLogSchema, swapped).ok).toBe(true);
    expect(migrateDietLogRowV4(swapped)).toBe(swapped);
  });

  it('non regressione: la Dieta di un giorno con spunte è identica prima e dopo, anche se poi il tipo cambia', () => {
    const p = plan();
    const raw = { date: '2026-10-12', planId: p.id, mealsFrom: null, eaten: { colazione: true, pranzo: true } };
    const log = dietLogSchema.parse(migrateDietLogRowV4(raw));
    const before = buildDayView(p.payload, 1, { today: true, eaten: raw.eaten, nowMinutes: 600 });
    const same = buildDayView(p.payload, 1, { today: true, eaten: log.eaten, nowMinutes: 600, mealSources: log.mealSources });
    expect(same?.meals).toEqual(before?.meals);
    expect(same?.eatenTotals).toEqual(before?.eatenTotals);
    // Il tipo diventa riposo (lunedì del piano è palestra): i pasti segnati restano quelli di prima.
    const rest = buildDayView(p.payload, 1, { today: true, eaten: log.eaten, nowMinutes: 600, mealSources: log.mealSources, type: 'rest' });
    expect(rest?.typeKey).toBe('rest');
    expect(rest?.eatenTotals.total.kcal).toBeCloseTo(before!.eatenTotals.total.kcal);
    expect(rest?.meals.find((m) => m.key === 'pranzo')?.name).toBe(before?.meals.find((m) => m.key === 'pranzo')?.name);
  });

  it('backup 3 → 4: tabelle vuote, diario migrato, inizio del calendario = giorno del backup; 1 → 4 dal file di prova', () => {
    const v3 = { schemaVersion: 3, createdAt: '2026-10-11T08:00:00.000Z', counts: { settings: 0 }, tables: { settings: [], dietLog: [] } };
    const v4 = backupV3ToV4(v3) as { schemaVersion: number; counts: Raw; tables: Raw };
    expect(v4.schemaVersion).toBe(4);
    expect(v4.tables).toMatchObject({ calendarEdits: [], dayChoices: [], settings: [{ key: 'calendarStart', value: '2026-10-11' }] });
    expect(v4.counts).toMatchObject({ calendarEdits: 0, dayChoices: 0, settings: 1 });

    const parsed = parseBackup(validBackupJson());
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    expect(parsed.value.schemaVersion).toBe(4);
    expect(parsed.value.tables.calendarEdits).toEqual([]);
    expect(parsed.value.tables.settings.find((s) => s.key === 'calendarStart')?.value).toBe('2026-10-11');
    for (const log of parsed.value.tables.dietLog) {
      expect(Object.keys(log.mealSources).sort()).toEqual(Object.keys(log.eaten).filter((k) => log.eaten[k]).sort());
    }
  });
});

describe('database v8 → v9', () => {
  const opened: HealthyDb[] = [];
  const open = (name: string, versions: readonly DbVersion[]) => {
    const d = new HealthyDb(name, versions);
    opened.push(d);
    return d;
  };
  afterEach(async () => {
    vi.useRealTimers();
    for (const d of opened.splice(0)) await d.delete();
  });

  it('tabelle nuove vuote, diario con la fonte dei pasti, inizio del calendario = oggi', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, 9, 0));
    const old = open('v9-cal', DB_VERSIONS.slice(0, 8));
    await old.table('dietLog').add({ date: '2026-10-12', planId: 'p', mealsFrom: null, eaten: { colazione: true } });
    old.close();

    const next = open('v9-cal', DB_VERSIONS);
    await next.open();
    expect(next.verno).toBe(latestVersion());
    expect(await next.calendarEdits.count()).toBe(0);
    expect(await next.dayChoices.count()).toBe(0);
    const log = await next.dietLog.get('2026-10-12');
    expect(log?.mealSources).toEqual({ colazione: { weekday: 1, type: null } });
    expect(await next.settings.get('calendarStart')).toEqual({ key: 'calendarStart', value: '2026-10-13' });
  });

  it('se la v9 fallisce resta la v8 con i dati di prima', async () => {
    const old = open('v9-fail', DB_VERSIONS.slice(0, 8));
    const row = { date: '2026-10-12', planId: 'p', mealsFrom: null, eaten: { colazione: true } };
    await old.table('dietLog').add(row);
    old.close();
    const v9 = DB_VERSIONS[8]!;
    const broken: DbVersion = {
      ...v9,
      upgrade: async (tx) => {
        await v9.upgrade?.(tx);
        throw new Error('migrazione rotta');
      },
    };
    const failing = open('v9-fail', [...DB_VERSIONS.slice(0, 8), broken]);
    await expect(failing.open()).rejects.toThrow();
    failing.close();
    const again = open('v9-fail', DB_VERSIONS.slice(0, 8));
    await again.open();
    expect(again.verno).toBe(8);
    expect(await again.table('dietLog').toArray()).toEqual([row]);
  });
});

describe('repository del calendario', () => {
  beforeEach(resetDb);

  it('scrive un cambio in una transazione e "Annulla" rimette le righe di prima', async () => {
    const first = move('workout', 'petto', '2026-10-12', '2026-10-13');
    await applyCalendarChange({ put: [first], remove: [], choicesRemove: [] });
    await setDayChoice('2026-10-15', 'run');

    const second = { ...first, toDate: '2026-10-14' };
    const undo = await applyCalendarChange({
      put: [second, skip('run', 'corsa', '2026-10-15')],
      remove: [],
      choicesRemove: ['2026-10-15'],
    });
    expect((await listCalendarEdits()).map((e) => [e.key, e.toDate]).sort()).toEqual([
      ['run:corsa:2026-10-15', null],
      ['workout:petto:2026-10-12', '2026-10-14'],
    ]);
    expect(await listDayChoices()).toEqual([]);

    await undoCalendarChange(undo);
    expect(await listCalendarEdits()).toEqual([first]);
    expect(await listDayChoices()).toEqual([{ date: '2026-10-15', dietType: 'run' }]);
  });

  it('righe non valide rifiutate prima di scrivere; la scelta palestra toglie la riga', async () => {
    const bad = { ...move('workout', 'petto', '2026-10-12', '2026-10-12') };
    expect(validate(calendarEditSchema, bad).ok).toBe(false);
    await expect(applyCalendarChange({ put: [bad], remove: [], choicesRemove: [] })).rejects.toBeInstanceOf(ValidationError);
    expect(await listCalendarEdits()).toEqual([]);
    await setDayChoice('2026-10-15', 'run');
    await setDayChoice('2026-10-15', null);
    expect(await listDayChoices()).toEqual([]);
  });

  it('backup e ripristino con le tabelle nuove', async () => {
    await applyCalendarChange({ put: [move('workout', 'petto', '2026-10-12', '2026-10-13')], remove: [], choicesRemove: [] });
    await setDayChoice('2026-10-15', 'run');
    const backup = await buildBackup(new Date('2026-10-13T10:00:00.000Z'));
    expect(backup.counts).toMatchObject({ calendarEdits: 1, dayChoices: 1 });
    await resetDb();
    await restoreBackup(backup);
    expect(await db.calendarEdits.count()).toBe(1);
    expect(await listDayChoices()).toEqual([{ date: '2026-10-15', dietType: 'run' }]);
    expect(await getCalendarStart()).toBeNull();
  });
});
