// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../src/lib/data/db';
import { ValidationError } from '../../../src/lib/data/errors';
import { importWorkout, restorePreviousVersion, saveWorkout } from '../../../src/lib/data/repo/workouts';
import { setWorkoutAuthor } from '../../../src/lib/data/repo/settings';
import type { WorkoutFile } from '../../../src/lib/data/schemas/workout-file';
import { workoutSchema, type Workout } from '../../../src/lib/data/schemas/workouts';
import { contentHash } from '../../../src/lib/share/canonical';
import {
  decideWorkoutImport,
  exerciseIndex,
  fileToWorkout,
  isLocallyEdited,
} from '../../../src/lib/share/import/workout';
import { draftFromWorkout } from '../../../src/lib/workouts/draft';
import { isOwnWorkout } from '../../../src/lib/workouts/calc/version';
import { originLabel } from '../../../src/lib/workouts/format';
import { resetDb } from '../data/helpers';
import { ME_OWN, ME_PT } from '../workouts/helpers';
import { typicalWorkoutFile } from './helpers';

const NOW = new Date('2026-10-12T10:00:00.000Z');
const LATER = new Date('2026-10-13T10:00:00.000Z');
const NO_LIBRARY = new Map<string, string>();

function received(file: WorkoutFile): Workout {
  return fileToWorkout(file, NO_LIBRARY, 'new', NOW);
}

function v(file: WorkoutFile, version: number, patch: Partial<WorkoutFile> = {}): WorkoutFile {
  return { ...file, ...patch, version };
}

describe('file ricevuto → scheda', () => {
  it('tiene id, versione, autore e origine; ricorda versione e impronta; collega la libreria per nome', () => {
    const file = typicalWorkoutFile();
    const library = exerciseIndex([
      { id: 'fx-panca', name: 'Panca piana con BILANCIERE' },
      { id: 'it-lat', name: 'Lat machìne presa  larga' },
    ]);
    const w = fileToWorkout(file, library, 'new', NOW);
    expect(workoutSchema.safeParse(w).success).toBe(true);
    expect(w).toMatchObject({ id: file.id, version: 3, author: 'Coach Finto', source: 'pt', previousVersions: [] });
    expect(w.received).toEqual({ version: 3, hash: contentHash(file), at: NOW.toISOString() });
    expect(w.items.map((i) => i.exerciseId)).toEqual(['fx-panca', 'it-lat', null, null, null, null]);
    expect(isLocallyEdited(w)).toBe(false);
  });

  it('copia: nuovo id, nome "… (copia)", stesso autore, non risulta modificata', () => {
    const file = typicalWorkoutFile();
    const copy = fileToWorkout(file, NO_LIBRARY, 'copy', NOW);
    expect(copy.id).not.toBe(file.id);
    expect(copy).toMatchObject({ name: 'Petto + Schiena (copia)', author: 'Coach Finto', version: 3 });
    expect(isLocallyEdited(copy)).toBe(false);
  });
});

describe('matrice delle versioni', () => {
  const file = typicalWorkoutFile(); // v3

  it('id nuovo → importa', () => {
    expect(decideWorkoutImport(file, undefined)).toMatchObject({ status: 'new', actions: ['new'], defaultAction: 'new' });
  });

  it.each([
    [4, 'newer', ['replace', 'copy'], 'replace'],
    [3, 'same', ['copy'], 'copy'],
    [2, 'older', ['copy'], 'copy'],
  ] as const)('non modificata: in arrivo v%i contro la mia v3 → %s', (incoming, status, actions, defaultAction) => {
    const mine = received(file);
    expect(decideWorkoutImport(v(file, incoming), mine)).toMatchObject({ status, actions, defaultAction, localEdits: false, base: 3 });
  });

  it('modificata qui (v3 ricevuta → v4 mia): la v4 del PT è comunque più nuova; si propone la copia', () => {
    const mine = { ...received(file), version: 4, intro: 'Cambiata da me' };
    expect(isLocallyEdited(mine)).toBe(true);
    expect(decideWorkoutImport(v(file, 4), mine)).toMatchObject({
      status: 'newer',
      localEdits: true,
      base: 3,
      actions: ['replace', 'copy'],
      defaultAction: 'copy',
    });
    expect(decideWorkoutImport(v(file, 3), mine)).toMatchObject({ status: 'same', localEdits: true, actions: ['copy'] });
    expect(decideWorkoutImport(v(file, 2), mine)).toMatchObject({ status: 'older', localEdits: true });
  });

  it('contenuto cambiato senza nuova versione conta come modifica', () => {
    const mine = { ...received(file), name: 'Rinominata' };
    expect(isLocallyEdited(mine)).toBe(true);
  });

  it('una mia scheda (non ricevuta) con lo stesso id: confronto con la mia versione', () => {
    const mine = { ...received(file), received: null, version: 5 };
    expect(decideWorkoutImport(v(file, 6), mine)).toMatchObject({ status: 'newer', localEdits: false, defaultAction: 'replace' });
    expect(decideWorkoutImport(v(file, 5), mine)).toMatchObject({ status: 'same' });
  });
});

describe('origine e proprietà delle schede ricevute', () => {
  it('etichetta "NOME · vN"; senza autore "RICEVUTA · vN"; mie "TUA" / "PT · vN"', () => {
    const w = received(typicalWorkoutFile());
    expect(originLabel(w)).toBe('COACH FINTO · v3');
    expect(originLabel({ ...w, author: '' })).toBe('RICEVUTA · v3');
    expect(originLabel({ ...w, author: 'Massimiliano Bartolomei' })).toBe('MASSIMILIANO B… · v3');
    expect(originLabel({ ...w, received: null })).toBe('PT · v3');
    expect(originLabel({ ...w, received: null, source: 'own' })).toBe('TUA');
  });

  it('una scheda ricevuta è mia solo se l’autore sono io (anche se l’amico l’aveva creata per sé)', () => {
    const w = received(typicalWorkoutFile());
    expect(isOwnWorkout(w, ME_OWN)).toBe(false);
    expect(isOwnWorkout({ ...w, source: 'own' }, ME_OWN)).toBe(false);
    expect(isOwnWorkout({ ...w, source: 'own', author: '' }, ME_OWN)).toBe(false);
    expect(isOwnWorkout(w, ME_PT)).toBe(true); // "Coach Finto" sono io
    expect(isOwnWorkout({ ...w, received: null, source: 'own' }, ME_OWN)).toBe(true);
  });
});

describe('salvataggio (database)', () => {
  beforeEach(resetDb);

  async function caught(promise: Promise<unknown>): Promise<ValidationError> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      return error as ValidationError;
    }
    throw new Error('Mi aspettavo un errore');
  }

  it('importa, poi sostituisce con la v+1 conservando la cronologia (max 3); le sessioni non cambiano', async () => {
    const file = typicalWorkoutFile();
    const first = await importWorkout(file, 'new', NOW);
    expect(first).toMatchObject({ mode: 'new', replaced: null });
    await db.sessions.add({
      id: 's1',
      workoutId: file.id,
      workoutVersion: 3,
      workoutName: file.name,
      startedAt: NOW.toISOString(),
      endedAt: NOW.toISOString(),
      readiness: null,
      sets: [],
      userNotes: [],
      rpe: null,
      cardioDone: null,
      snapshot: null,
      live: null,
    });
    const sessionBefore = await db.sessions.get('s1');

    for (let n = 4; n <= 7; n++) {
      const out = await importWorkout(v(file, n, { intro: `Versione ${n}` }), 'replace', LATER);
      expect(out.replaced).toBe(n - 1);
    }
    const stored = (await db.workouts.get(file.id))!;
    expect(stored.version).toBe(7);
    expect(stored.previousVersions.map((p) => p.version)).toEqual([6, 5, 4]);
    expect(stored.previousVersions[0]).not.toHaveProperty('previousVersions');
    expect(await db.sessions.get('s1')).toEqual(sessionBefore);
    expect(await db.workouts.count()).toBe(1);
  });

  it('copia accanto alla mia; uguale/minore non si possono sostituire; id già presente non è "nuovo"', async () => {
    const file = typicalWorkoutFile();
    await importWorkout(file, 'new', NOW);
    const copy = await importWorkout(file, 'copy', NOW);
    expect(copy.workout.name).toBe('Petto + Schiena (copia)');
    expect(await db.workouts.count()).toBe(2);
    expect((await caught(importWorkout(file, 'replace', NOW))).errors[0]).toMatch(/cambiata nel frattempo/);
    expect((await caught(importWorkout(v(file, 2), 'replace', NOW))).errors[0]).toMatch(/cambiata nel frattempo/);
    expect((await caught(importWorkout(file, 'new', NOW))).errors[0]).toMatch(/cambiata nel frattempo/);
    expect(await db.workouts.count()).toBe(2);
  });

  it('ripristina una versione precedente: quella attuale entra nella cronologia (si può tornare indietro)', async () => {
    const file = typicalWorkoutFile();
    await importWorkout(file, 'new', NOW);
    await importWorkout(v(file, 4, { intro: 'Nuova' }), 'replace', LATER);
    const restored = await restorePreviousVersion(file.id, 0, LATER);
    expect(restored).toMatchObject({ version: 3, intro: file.intro });
    expect(restored.previousVersions.map((p) => p.version)).toEqual([4]);
    const again = await restorePreviousVersion(file.id, 0, LATER);
    expect(again).toMatchObject({ version: 4, intro: 'Nuova' });
    expect((await caught(restorePreviousVersion(file.id, 5))).errors[0]).toMatch(/Versione non trovata/);
  });

  it('modificare e salvare una mia scheda ricevuta non perde origine né cronologia', async () => {
    const file = typicalWorkoutFile(); // autore "Coach Finto"
    await setWorkoutAuthor(ME_PT); // io sono "Coach Finto"
    await importWorkout(file, 'new', NOW);
    await importWorkout(v(file, 4), 'replace', NOW);
    const stored = (await db.workouts.get(file.id))!;
    const draft = { ...draftFromWorkout(stored), intro: 'Modificata qui' };
    const saved = await saveWorkout(draft, LATER);
    expect(saved).toMatchObject({ kind: 'update', from: 4 });
    expect(saved.workout.received).toEqual(stored.received);
    expect(saved.workout.previousVersions).toEqual(stored.previousVersions);
    expect(isLocallyEdited(saved.workout)).toBe(true);
    // Il PT (che sono io su un altro telefono) manda la sua v5: è più nuova della v4 ricevuta, ma ho modifiche.
    expect(decideWorkoutImport(v(file, 5), saved.workout)).toMatchObject({ status: 'newer', localEdits: true, defaultAction: 'copy' });
  });

  it('modificare una scheda ricevuta da un altro crea la mia copia, l’originale resta aggiornabile', async () => {
    const file = typicalWorkoutFile();
    await setWorkoutAuthor(ME_OWN);
    await importWorkout(file, 'new', NOW);
    const stored = (await db.workouts.get(file.id))!;
    const saved = await saveWorkout({ ...draftFromWorkout(stored), intro: 'Mia versione' }, LATER);
    expect(saved.kind).toBe('copy');
    expect(saved.workout).toMatchObject({ received: null, previousVersions: [], source: 'own' });
    expect(isLocallyEdited((await db.workouts.get(file.id))!)).toBe(false);
  });
});
