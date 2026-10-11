// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { restoreBackup } from '../../../src/lib/data/backup';
import { db } from '../../../src/lib/data/db';
import { ValidationError } from '../../../src/lib/data/errors';
import { activateDietPlan, getActiveDietPlan, dietPlansRepo } from '../../../src/lib/data/repo/diet-plans';
import { dietLogBetween, setMealEaten } from '../../../src/lib/data/repo/diet-log';
import { exercisesForMuscle, listExercisesByName } from '../../../src/lib/data/repo/exercises';
import { clearAll, countAll } from '../../../src/lib/data/repo/maintenance';
import { measurementsBetween, listMeasurementsByDate } from '../../../src/lib/data/repo/measurements';
import { getProfile, saveProfile } from '../../../src/lib/data/repo/profile';
import { lastSessionForWorkout, sessionsBetween, sessionsForWorkout } from '../../../src/lib/data/repo/sessions';
import { getSetting, setSetting } from '../../../src/lib/data/repo/settings';
import { listWorkoutsRecent, workoutsForWeekday, workoutsRepo } from '../../../src/lib/data/repo/workouts';
import { parseBackup } from '../../../src/lib/data/backup';
import type { Backup } from '../../../src/lib/data/schemas/backup';
import type { Workout } from '../../../src/lib/data/schemas/workouts';
import { clone, resetDb, validBackupJson } from './helpers';

function fixtureBackup(): Backup {
  const result = parseBackup(validBackupJson());
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

const backup = fixtureBackup();
const workout = (): Workout => clone(backup.tables.workouts[0]!);

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Mi aspettavo un errore');
}

beforeEach(resetDb);

describe('createTableRepo', () => {
  it('crea, legge, elenca, conta, modifica ed elimina', async () => {
    const created = await workoutsRepo.add(workout());
    expect(await workoutsRepo.get(created.id)).toEqual(created);
    expect(await workoutsRepo.count()).toBe(1);
    expect(await workoutsRepo.list()).toEqual([created]);

    const updated = await workoutsRepo.update(created.id, { name: 'Petto + Schiena (v5)', version: 5 });
    expect(updated).toMatchObject({ id: created.id, name: 'Petto + Schiena (v5)', version: 5, items: created.items });
    expect(await workoutsRepo.get(created.id)).toEqual(updated);

    await workoutsRepo.remove(created.id);
    expect(await workoutsRepo.get(created.id)).toBeUndefined();
    expect(await workoutsRepo.count()).toBe(0);
  });

  it('ogni scrittura è validata: niente salvato se i dati non sono validi', async () => {
    const bad = { ...workout(), name: '', items: [{ ...workout().items[0]!, kg: -5 }] };
    const error = await caught(workoutsRepo.add(bad));
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      'nome: non può essere vuoto',
      'elementi › n. 1 › kg: valore troppo basso: minimo 0',
    ]);
    expect(await workoutsRepo.count()).toBe(0);
  });

  it('i testi vengono ripuliti prima di salvare', async () => {
    const saved = await workoutsRepo.put({ ...workout(), name: '  Gambe  ' });
    expect(saved.name).toBe('Gambe');
    expect((await workoutsRepo.get(saved.id))!.name).toBe('Gambe');
  });

  it('update non valido: la riga resta com’era; la chiave non cambia', async () => {
    const created = await workoutsRepo.add(workout());
    await expect(workoutsRepo.update(created.id, { weekdays: [1, 9] })).rejects.toBeInstanceOf(ValidationError);
    expect(await workoutsRepo.get(created.id)).toEqual(created);

    const same = await workoutsRepo.update(created.id, { id: 'altro-id', intro: 'Nuova intro' });
    expect(same.id).toBe(created.id);
    expect(await workoutsRepo.get('altro-id')).toBeUndefined();
  });

  it('update di una riga inesistente → messaggio chiaro', async () => {
    const error = await caught(workoutsRepo.update('manca', { name: 'x' }));
    expect((error as ValidationError).errors).toEqual(['Schede: elemento «manca» non trovato']);
  });

  it('add con una chiave già presente fallisce, put la sostituisce', async () => {
    await workoutsRepo.add(workout());
    await expect(workoutsRepo.add(workout())).rejects.toThrow();
    await workoutsRepo.put({ ...workout(), version: 9 });
    expect((await workoutsRepo.get(workout().id))!.version).toBe(9);
  });
});

describe('query sugli indici', () => {
  beforeEach(() => restoreBackup(backup));

  it('schede per data di modifica e per giorno', async () => {
    expect((await listWorkoutsRecent()).map((w) => w.name)).toEqual(['Petto + Schiena', 'Corsa 5 km']);
    expect((await workoutsForWeekday(4)).map((w) => w.name)).toEqual(['Petto + Schiena']);
    expect(await workoutsForWeekday(7)).toEqual([]);
  });

  it('sessioni: per scheda, ultima volta, intervallo', async () => {
    const id = backup.tables.workouts[0]!.id;
    expect((await sessionsForWorkout(id)).map((s) => s.startedAt)).toEqual([
      '2026-10-05T16:00:00.000Z',
      '2026-10-08T16:10:00.000Z',
    ]);
    expect((await lastSessionForWorkout(id))!.startedAt).toBe('2026-10-08T16:10:00.000Z');
    expect(await lastSessionForWorkout('nessuna')).toBeUndefined();
    const october = await sessionsBetween('2026-10-06T00:00:00.000Z', '2026-10-11T00:00:00.000Z');
    expect(october.map((s) => s.workoutName)).toEqual(['Petto + Schiena', 'Corsa 5 km']);
  });

  it('misure per data e libreria esercizi', async () => {
    expect((await listMeasurementsByDate()).map((m) => m.date)).toEqual(['2026-08-14', '2026-09-25']);
    expect((await measurementsBetween('2026-09-01', '2026-09-30')).map((m) => m.date)).toEqual(['2026-09-25']);
    expect((await listExercisesByName()).map((e) => e.id)).toEqual([
      'lat-machine',
      'panca-piana',
      'e3c11111-1111-4111-8111-111111111111',
    ]);
    expect((await exercisesForMuscle('Pettorali')).map((e) => e.id)).toEqual(['panca-piana']);
  });

  it('un solo piano attivo', async () => {
    const first = backup.tables.dietPlans[0]!;
    const second = { ...clone(first), id: 'd2222222-2222-4222-8222-222222222222', title: 'Piano 2', active: false, archived: true };
    await dietPlansRepo.add(second);
    await activateDietPlan(second.id);
    expect((await getActiveDietPlan())!.id).toBe(second.id);
    const plans = await dietPlansRepo.list();
    expect(plans.filter((p) => p.active)).toHaveLength(1);
    expect(plans.find((p) => p.id === second.id)!.archived).toBe(false);
    await expect(activateDietPlan('manca')).rejects.toBeInstanceOf(ValidationError);
    expect((await getActiveDietPlan())!.id).toBe(second.id);
  });

  it('diario dieta: segna un pasto, crea il giorno se manca', async () => {
    const planId = backup.tables.dietPlans[0]!.id;
    await setMealEaten('2026-10-07', planId, 'pranzo', true);
    await setMealEaten('2026-10-05', planId, 'spuntino2', true);
    const days = await dietLogBetween('2026-10-05', '2026-10-07');
    expect(days.map((d) => [d.date, d.eaten])).toEqual([
      ['2026-10-05', { colazione: true, pranzo: true, spuntino2: true }],
      ['2026-10-06', { colazione: true }],
      ['2026-10-07', { pranzo: true }],
    ]);
  });
});

describe('profilo e impostazioni', () => {
  it('profilo a riga unica', async () => {
    expect(await getProfile()).toBeUndefined();
    await saveProfile({ name: 'Prova', birthYear: 1990, sex: null, heightCm: 180, goal: 'maintain' });
    await saveProfile({ name: 'Prova 2', birthYear: 1990, sex: null, heightCm: 180, goal: 'lose' });
    expect(await getProfile()).toEqual({ id: 'me', name: 'Prova 2', birthYear: 1990, sex: null, heightCm: 180, goal: 'lose' });
    expect(await db.profile.count()).toBe(1);
  });

  it('impostazioni tipizzate e validate', async () => {
    expect(await getSetting('lastBackupAt')).toBeNull();
    await setSetting('lastBackupAt', '2026-10-01T10:00:00.000Z');
    expect(await getSetting('lastBackupAt')).toBe('2026-10-01T10:00:00.000Z');
    await expect(setSetting('lastBackupAt', 'ieri')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('manutenzione', () => {
  it('conta e svuota tutto in una transazione, tenendo le impostazioni del telefono', async () => {
    await restoreBackup(backup);
    await setSetting('lastBackupAt', '2026-10-01T10:00:00.000Z');
    const counts = await countAll();
    // Le impostazioni del telefono non contano: come nel backup.
    expect(counts).toEqual(backup.counts);

    await clearAll();
    expect(await countAll()).toEqual({
      profile: 0,
      measurements: 0,
      exercises: 0,
      workouts: 0,
      sessions: 0,
      dietPlans: 0,
      dietLog: 0,
      shopping: 0,
      settings: 0,
    });
    expect(await getSetting('lastBackupAt')).toBe('2026-10-01T10:00:00.000Z');
  });
});
