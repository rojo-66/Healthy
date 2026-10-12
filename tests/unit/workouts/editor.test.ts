// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../src/lib/data/db';
import { ValidationError } from '../../../src/lib/data/errors';
import {
  createCustomExercise,
  customExerciseUsage,
  deleteCustomExercise,
  updateCustomExercise,
} from '../../../src/lib/data/repo/exercises';
import { clearWorkoutDraft, getWorkoutAuthor, getWorkoutDraft, saveWorkoutDraft, setWorkoutAuthor } from '../../../src/lib/data/repo/settings';
import { deleteWorkout, duplicateWorkoutById, saveWorkout } from '../../../src/lib/data/repo/workouts';
import { workoutSchema } from '../../../src/lib/data/schemas/workouts';
import { firstItemWithError, itemErrors, validateDraft } from '../../../src/lib/workouts/calc/editor-schema';
import { copyName, duplicateWorkout, isOwnWorkout, prepareSave, saveKind, versionAfterSave } from '../../../src/lib/workouts/calc/version';
import {
  draftFingerprint,
  draftFromWorkout,
  draftToCandidate,
  duplicateItem,
  emptyDraft,
  itemFromExercise,
  moveItem,
  removeItem,
  updateItem,
} from '../../../src/lib/workouts/draft';
import { deleteWarning } from '../../../src/lib/workouts/library/custom';
import { syncLibrary } from '../../../src/lib/workouts/library/sync';
import { resetDb } from '../data/helpers';
import { customExercise, ME_OWN, ME_PT, MONDAY, SAME_PT, weekWorkouts, workoutNamed } from './helpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const BENCH = { id: 'fx-barbell-bench-press-medium-grip', name: 'Panca piana con bilanciere', muscles: ['Petto', 'Tricipiti'], videoUrl: null };
const LAT = { id: 'fx-wide-grip-lat-pulldown', name: 'Lat machine presa larga', muscles: ['Dorsali'], videoUrl: null };

function newDraft(name = 'Spinta') {
  const d = emptyDraft(ME_OWN);
  return { ...d, name, weekdays: [4, 1], items: [itemFromExercise(BENCH), itemFromExercise(LAT)] };
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Mi aspettavo un errore');
}

describe('versioni e origine', () => {
  const pt = workoutNamed('Petto + Schiena'); // PT di prova, v3
  const own = workoutNamed('Braccia'); // TUA, v1

  it('scheda nuova → v1', () => {
    expect(saveKind(undefined, ME_OWN)).toBe('new');
    expect(versionAfterSave(undefined, ME_OWN)).toBe(1);
  });

  it('scheda mia → stesso id, versione + 1 (v3 → v4)', () => {
    expect(isOwnWorkout(own, ME_OWN)).toBe(true);
    expect(isOwnWorkout(pt, SAME_PT)).toBe(true); // stesso nome, maiuscole diverse
    const saved = prepareSave(pt, pt, SAME_PT, MONDAY);
    expect(saved).toMatchObject({ id: pt.id, version: 4, source: 'pt', author: 'PT di prova' });
    expect(saved.updatedAt).toBe(MONDAY.toISOString());
  });

  it('scheda di un altro PT → mia copia: nuovo id, v1, TUA', () => {
    expect(isOwnWorkout(pt, ME_PT)).toBe(false);
    expect(isOwnWorkout(pt, ME_OWN)).toBe(false);
    const saved = prepareSave(pt, pt, ME_PT, MONDAY);
    expect(saved.id).not.toBe(pt.id);
    expect(saved.id).toMatch(UUID);
    expect(saved).toMatchObject({ version: 1, source: 'own', author: '' });
  });

  it('duplica: nuovo id, v1, "(copia)", senza giorni, origine come una scheda nuova', () => {
    const copy = duplicateWorkout(pt, ME_OWN, MONDAY);
    expect(copy.id).not.toBe(pt.id);
    expect(copy).toMatchObject({ version: 1, name: 'Petto + Schiena (copia)', weekdays: [], source: 'own', author: '' });
    expect(copy.items).toEqual(pt.items);
    expect(duplicateWorkout(own, ME_PT, MONDAY)).toMatchObject({ source: 'pt', author: 'Coach Finto' });
    expect(workoutSchema.safeParse(copy).success).toBe(true);
    expect(copyName('x'.repeat(120))).toHaveLength(120);
  });
});

describe('bozza', () => {
  it('scheda nuova: id UUID, nessuna versione, origine dall\'impostazione', () => {
    expect(emptyDraft(ME_OWN)).toMatchObject({ baseVersion: null, source: 'own', author: '' });
    expect(emptyDraft(ME_PT)).toMatchObject({ source: 'pt', author: 'Coach Finto' });
    expect(emptyDraft(ME_OWN).workoutId).toMatch(UUID);
  });

  it('da scheda a bozza e ritorno senza perdite', () => {
    const w = workoutNamed('Petto + Schiena');
    const candidate = draftToCandidate(draftFromWorkout(w), new Date(w.updatedAt));
    expect(workoutSchema.parse(candidate)).toEqual(w);
  });

  it('esercizio aggiunto dalla libreria: 3 × 10, 0 kg, 90 s', () => {
    expect(itemFromExercise(BENCH)).toMatchObject({ exerciseId: BENCH.id, sets: 3, reps: 10, kg: 0, restSec: 90, videoUrl: '' });
  });

  it('su, giù, duplica, elimina; l\'impronta cambia solo con il contenuto', () => {
    const d = newDraft();
    const fp = draftFingerprint(d);
    expect(draftFingerprint({ ...d, items: d.items.map((i) => ({ ...i, key: 'altra' })) })).toBe(fp);
    const moved = moveItem(d, 1, 0);
    expect(moved.items.map((i) => i.name)).toEqual([LAT.name, BENCH.name]);
    expect(draftFingerprint(moved)).not.toBe(fp);
    const dup = duplicateItem(d, 0);
    expect(dup.items).toHaveLength(3);
    expect(dup.items[1]!.key).not.toBe(dup.items[0]!.key);
    expect(removeItem(d, 0).items.map((i) => i.name)).toEqual([LAT.name]);
    expect(updateItem(d, 1, { reps: 12 }).items[1]!.reps).toBe(12);
  });
});

describe('validazione dell\'editor', () => {
  it('una bozza completa è una scheda valida, giorni in ordine', () => {
    const result = validateDraft(newDraft(), MONDAY);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.weekdays).toEqual([1, 4]);
  });

  it('errori in italiano accanto al campo', () => {
    const d = newDraft('');
    d.items[1] = { ...d.items[1]!, reps: 0, videoUrl: 'http://video.example.com' };
    const result = validateDraft(d, MONDAY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields['name']).toBe('non può essere vuoto');
    expect(result.fields['items.1.reps']).toBe('almeno 1 ripetizione');
    expect(result.fields['items.1.videoUrl']).toBe('indirizzo web non valido: deve iniziare con https://');
    expect(firstItemWithError(result.fields)).toBe(1);
    expect(itemErrors(result.fields, 1)).toEqual({
      reps: 'almeno 1 ripetizione',
      videoUrl: 'indirizzo web non valido: deve iniziare con https://',
    });
  });

  it('senza esercizi, o con un esercizio senza nome o senza serie, non si salva', () => {
    const empty = validateDraft({ ...newDraft(), items: [] }, MONDAY);
    expect(empty.ok || empty.fields['items']).toBe('aggiungi almeno un esercizio');
    const d = newDraft();
    d.items[0] = { ...d.items[0]!, name: '', sets: 0 };
    const bad = validateDraft(d, MONDAY);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.fields['items.0.name']).toBe('non può essere vuoto');
      expect(bad.fields['items.0.sets']).toBe('valore troppo basso: minimo 1');
    }
  });

  it('scheda del PT senza nome dell\'autore', () => {
    const result = validateDraft({ ...newDraft(), source: 'pt', author: '' }, MONDAY);
    expect(result.ok || result.fields['author']).toBe('scrivi il nome del PT');
  });

  it('serie piramidali con 0 ripetizioni', () => {
    const d = newDraft();
    d.items[0] = { ...d.items[0]!, sets: 2, setsDetail: [{ reps: 8, kg: 50 }, { reps: 0, kg: 55 }] };
    const result = validateDraft(d, MONDAY);
    expect(result.ok || result.fields['items.0.setsDetail.1.reps']).toBe('almeno 1 ripetizione');
  });
});

describe('salvataggio nel database', () => {
  beforeEach(resetDb);

  it('crea v1, poi modifica v1 → v2 con lo stesso id, e cancella la bozza', async () => {
    const d = newDraft();
    await saveWorkoutDraft(d, MONDAY);
    const first = await saveWorkout(d, MONDAY);
    expect(first).toMatchObject({ kind: 'new', from: null });
    expect(first.workout).toMatchObject({ id: d.workoutId, version: 1, source: 'own', name: 'Spinta' });
    expect(await getWorkoutDraft()).toBeNull();

    const edit = updateItem(draftFromWorkout(first.workout), 0, { kg: 60 });
    const second = await saveWorkout(edit, MONDAY);
    expect(second).toMatchObject({ kind: 'update', from: 1 });
    expect(second.workout).toMatchObject({ id: d.workoutId, version: 2 });
    expect(await db.workouts.count()).toBe(1);
    expect((await db.workouts.get(d.workoutId))?.items[0]?.kg).toBe(60);
  });

  it('dati non validi: errore in italiano e nessuna scrittura', async () => {
    const error = await caught(saveWorkout(newDraft(''), MONDAY));
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toContain('nome: non può essere vuoto');
    expect(await db.workouts.count()).toBe(0);
  });

  it('scheda nuova del PT: si ricorda il nome se manca, l\'origine predefinita resta quella del Profilo', async () => {
    expect(await getWorkoutAuthor()).toEqual(ME_OWN);
    await saveWorkout({ ...newDraft(), source: 'pt', author: 'Coach Finto' }, MONDAY);
    expect(await getWorkoutAuthor()).toEqual({ name: 'Coach Finto', lastSource: 'own' });
    expect(emptyDraft(await getWorkoutAuthor())).toMatchObject({ source: 'own', author: '' });

    // Un nome già scelto (nel Profilo) non viene cambiato dall'editor.
    await setWorkoutAuthor(ME_PT);
    await saveWorkout({ ...newDraft('Tirata'), source: 'pt', author: 'Altro Coach' }, MONDAY);
    await saveWorkout({ ...newDraft('Gambe'), source: 'own' }, MONDAY);
    expect(await getWorkoutAuthor()).toEqual(ME_PT);
    expect(emptyDraft(await getWorkoutAuthor())).toMatchObject({ source: 'pt', author: 'Coach Finto' });
  });

  it('modificare una scheda di un altro PT crea una mia copia; l\'originale resta', async () => {
    const pt = workoutNamed('Petto + Schiena');
    await db.workouts.add(pt);
    await setWorkoutAuthor(ME_OWN);
    const saved = await saveWorkout(updateItem(draftFromWorkout(pt), 1, { reps: 12 }), MONDAY);
    expect(saved.kind).toBe('copy');
    expect(saved.workout).toMatchObject({ version: 1, source: 'own', author: '' });
    expect(await db.workouts.get(pt.id)).toEqual(pt);
    expect(await db.workouts.count()).toBe(2);
  });

  it('duplica ed elimina (con la sua bozza)', async () => {
    const { workout } = await saveWorkout(newDraft(), MONDAY);
    const copy = await duplicateWorkoutById(workout.id, MONDAY);
    expect(copy).toMatchObject({ version: 1, name: 'Spinta (copia)', weekdays: [] });
    expect(await db.workouts.count()).toBe(2);
    await saveWorkoutDraft(draftFromWorkout(copy), MONDAY);
    await deleteWorkout(copy.id);
    expect(await db.workouts.count()).toBe(1);
    expect(await getWorkoutDraft()).toBeNull();
  });

  it('la bozza si salva anche incompleta e si ritrova', async () => {
    const d = { ...emptyDraft(ME_OWN), name: '' };
    await saveWorkoutDraft(d, MONDAY);
    expect(await getWorkoutDraft()).toEqual({ savedAt: MONDAY.toISOString(), draft: d });
    await clearWorkoutDraft();
    expect(await getWorkoutDraft()).toBeNull();
  });
});

describe('esercizi personalizzati', () => {
  beforeEach(resetDb);

  it('crea, modifica ed elimina; muscoli e attrezzo dalle liste', async () => {
    const ex = await createCustomExercise({ name: 'Crunch sul rullo', muscles: ['Addominali'], equipment: 'Altro', videoUrl: '' });
    expect(ex).toMatchObject({ custom: true, videoUrl: null });
    expect(ex.id).toMatch(UUID);
    const edited = await updateCustomExercise(ex.id, { ...ex, name: 'Crunch al rullo', videoUrl: 'https://example.com/v' });
    expect(edited).toMatchObject({ name: 'Crunch al rullo', videoUrl: 'https://example.com/v' });
    const bad = await caught(createCustomExercise({ name: 'X', muscles: ['Collo'], equipment: 'Altro', videoUrl: '' }));
    expect(bad).toBeInstanceOf(ValidationError);
    const none = await caught(createCustomExercise({ name: 'X', muscles: [], equipment: 'Altro', videoUrl: '' }));
    expect((none as ValidationError).errors).toContain('muscoli: scegli almeno un muscolo');
    await deleteCustomExercise(ex.id);
    expect(await db.exercises.get(ex.id)).toBeUndefined();
  });

  it('eliminare un personalizzato usato avvisa e non rompe la scheda', async () => {
    const ex = customExercise();
    await db.exercises.add(ex);
    await db.workouts.bulkAdd(weekWorkouts());
    const using = await customExerciseUsage(ex.id);
    expect(using.map((w) => w.name)).toEqual(['Àddome e mobilità']);
    expect(deleteWarning(ex, using)).toBe(
      '«Crunch sul rullo» è usato in una scheda («Àddome e mobilità»). Le schede restano invariate: nome e muscoli sono copiati.',
    );
    await deleteCustomExercise(ex.id);
    const w = await db.workouts.get(using[0]!.id);
    expect(w?.items[0]).toMatchObject({ exerciseId: ex.id, name: 'Crunch sul rullo', muscles: ['Addominali'] });
    expect(workoutSchema.safeParse(w).success).toBe(true);
    // La scheda si apre e si salva ancora nell'editor.
    expect((await saveWorkout(draftFromWorkout(w!), MONDAY)).workout.version).toBe(2);
  });

  it('gli esercizi della libreria non si modificano né si eliminano', async () => {
    await syncLibrary();
    expect(await caught(deleteCustomExercise('fx-plank'))).toBeInstanceOf(ValidationError);
    expect(await caught(updateCustomExercise('fx-plank', { name: 'X', muscles: ['Petto'], equipment: 'Altro', videoUrl: '' }))).toBeInstanceOf(
      ValidationError,
    );
  });
});
