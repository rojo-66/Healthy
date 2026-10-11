// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../src/lib/data/db';
import { createCustomExercise } from '../../../src/lib/data/repo/exercises';
import { buildBackup, restoreBackup } from '../../../src/lib/data/backup';
import { clearAll, countAll } from '../../../src/lib/data/repo/maintenance';
import { exerciseSchema } from '../../../src/lib/data/schemas/exercises';
import { COMMON_IDS, LIBRARY } from '../../../src/lib/workouts/library/data';
import { EQUIPMENT, MUSCLES, isEquipment, isMuscle } from '../../../src/lib/workouts/library/muscles';
import { normalize, searchExercises } from '../../../src/lib/workouts/library/search';
import { libraryExercises, syncLibrary } from '../../../src/lib/workouts/library/sync';
import { resetDb } from '../data/helpers';

describe('dati della libreria', () => {
  const rows = libraryExercises();

  it('ha più di 700 esercizi, tutti validi per lo schema del database', () => {
    expect(rows.length).toBeGreaterThan(700);
    for (const row of rows) expect(exerciseSchema.safeParse(row).success, row.id).toBe(true);
  });

  it('id e nomi sono unici (senza distinguere maiuscole)', () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.name.toLowerCase())).size).toBe(rows.length);
  });

  it('muscoli e attrezzi vengono dalle liste chiuse, con almeno un muscolo', () => {
    for (const [id, , muscles, equipment] of LIBRARY) {
      expect(muscles.length, id).toBeGreaterThan(0);
      expect(muscles.every(isMuscle), id).toBe(true);
      expect(isEquipment(equipment), id).toBe(true);
    }
    expect(MUSCLES).toHaveLength(14);
    expect(EQUIPMENT).toHaveLength(12);
  });

  it('ogni muscolo della lista ha almeno un esercizio come muscolo principale', () => {
    const primaries = new Set(rows.map((r) => r.muscles[0]));
    for (const m of MUSCLES) expect(primaries.has(m), m).toBe(true);
  });

  it('esercizi comuni: quelli con nome italiano o aggiunti a mano, tutti nella libreria', () => {
    const ids = new Set(rows.map((r) => r.id));
    expect(COMMON_IDS.size).toBeGreaterThan(250);
    for (const id of COMMON_IDS) expect(ids.has(id), id).toBe(true);
    expect(COMMON_IDS.has('fx-barbell-bench-press-medium-grip')).toBe(true);
    expect(COMMON_IDS.has('it-pressa-orizzontale')).toBe(true);
    expect(COMMON_IDS.has('fx-chain-press')).toBe(false);
  });

  it('id stabili: fx- dalla fonte, it- aggiunti a mano; nessun esercizio personalizzato', () => {
    expect(rows.every((r) => /^(fx|it)-[a-z0-9-]+$/.test(r.id))).toBe(true);
    expect(rows.every((r) => !r.custom && r.videoUrl === null)).toBe(true);
    expect(rows.find((r) => r.id === 'fx-barbell-bench-press-medium-grip')?.name).toBe('Panca piana con bilanciere');
  });
});

describe('ricerca', () => {
  const list = [
    { name: 'Panca piana con bilanciere', muscles: ['Petto', 'Tricipiti'] },
    { name: 'Panca inclinata con manubri', muscles: ['Petto'] },
    { name: 'Croci ai cavi', muscles: ['Petto'] },
    { name: 'Lat machine presa larga', muscles: ['Dorsali', 'Bicipiti'] },
    { name: 'Estensioni sopra la testa con manubrio', muscles: ['Tricipiti'] },
    { name: 'Curl alla panca Scott', muscles: ['Bicipiti'] },
  ];

  it('ignora maiuscole e accenti', () => {
    expect(normalize('  Pànca   PIANA ')).toBe('panca piana');
    expect(searchExercises(list, 'PANCA').map((x) => x.name)).toContain('Panca piana con bilanciere');
    expect(searchExercises(list, 'pànca pïana').map((x) => x.name)).toEqual(['Panca piana con bilanciere']);
  });

  it('tutte le parole devono comparire, in qualsiasi ordine', () => {
    expect(searchExercises(list, 'manubri panca').map((x) => x.name)).toEqual(['Panca inclinata con manubri']);
    expect(searchExercises(list, 'panca squat')).toEqual([]);
  });

  it('prima i nomi che iniziano con la ricerca, poi in ordine alfabetico', () => {
    expect(searchExercises(list, 'panca').map((x) => x.name)).toEqual([
      'Panca inclinata con manubri',
      'Panca piana con bilanciere',
      'Curl alla panca Scott',
    ]);
  });

  it('il filtro guarda il muscolo principale', () => {
    expect(searchExercises(list, '', 'Tricipiti').map((x) => x.name)).toEqual(['Estensioni sopra la testa con manubrio']);
    expect(searchExercises(list, 'lat', 'Dorsali')).toHaveLength(1);
    expect(searchExercises(list, '', 'Bicipiti').map((x) => x.name)).toEqual(['Curl alla panca Scott']);
    expect(searchExercises(list, '')).toHaveLength(list.length);
  });

  it('prima gli esercizi comuni o personalizzati, poi il resto', () => {
    const mixed = [
      { name: 'Alternating Floor Press', muscles: ['Petto'], common: false },
      { name: 'Panca piana con manubri', muscles: ['Petto'], common: true },
      { name: 'Chain Press', muscles: ['Petto'], common: false },
    ];
    expect(searchExercises(mixed, '', 'Petto', (x) => x.common).map((x) => x.name)).toEqual([
      'Panca piana con manubri',
      'Alternating Floor Press',
      'Chain Press',
    ]);
    // Chi inizia con la ricerca resta comunque davanti.
    expect(searchExercises(mixed, 'chain', null, (x) => x.common).map((x) => x.name)).toEqual(['Chain Press']);
  });

  it('funziona sulla libreria vera', () => {
    const found = searchExercises(libraryExercises(), 'lat machine', 'Dorsali').map((x) => x.name);
    expect(found).toContain('Lat machine presa larga');
  });
});

describe('caricamento della libreria', () => {
  beforeEach(resetDb);

  it('è idempotente: la seconda volta non scrive niente e non crea doppioni', async () => {
    const first = await syncLibrary();
    expect(first).toEqual({ added: LIBRARY.length, updated: 0 });
    expect(await db.exercises.count()).toBe(LIBRARY.length);
    const second = await syncLibrary();
    expect(second).toEqual({ added: 0, updated: 0 });
    expect(await db.exercises.count()).toBe(LIBRARY.length);
  });

  it('non tocca gli esercizi personalizzati', async () => {
    await syncLibrary();
    const mine = await createCustomExercise({ name: 'Crunch sul rullo', muscles: ['Addominali'], equipment: 'Altro', videoUrl: '' });
    await syncLibrary();
    expect(await db.exercises.get(mine.id)).toEqual(mine);
    expect(await db.exercises.count()).toBe(LIBRARY.length + 1);
  });

  it('una libreria aggiornata corregge le righe cambiate e aggiunge le nuove', async () => {
    await syncLibrary();
    // Simula un database scritto con una versione precedente della libreria.
    await db.exercises.update('fx-plank', { name: 'Plank (vecchio nome)', muscles: ['Lombari'] });
    await db.exercises.delete('fx-barbell-squat');
    const result = await syncLibrary();
    expect(result).toEqual({ added: 1, updated: 1 });
    expect((await db.exercises.get('fx-plank'))?.name).toBe('Plank');
    expect((await db.exercises.get('fx-plank'))?.muscles).toEqual(['Addominali']);
    expect(await db.exercises.get('fx-barbell-squat')).toBeDefined();
  });

  it('lascia le righe che la libreria non ha più', async () => {
    await db.exercises.add({ id: 'fx-esercizio-ritirato', name: 'Esercizio ritirato', muscles: ['Petto'], equipment: 'Altro', videoUrl: null, custom: false });
    await syncLibrary();
    expect(await db.exercises.get('fx-esercizio-ritirato')).toBeDefined();
  });

  it('la libreria è dell’app: fuori da conteggi e backup, "Svuota tutto" e ripristino non la toccano', async () => {
    await syncLibrary();
    const mine = await createCustomExercise({ name: 'Crunch sul rullo', muscles: ['Addominali'], equipment: 'Altro', videoUrl: '' });
    expect((await countAll()).exercises).toBe(1);
    const backup = await buildBackup(new Date(2026, 9, 12));
    expect(backup.tables.exercises.map((e) => e.id)).toEqual([mine.id]);

    await clearAll();
    expect(await db.exercises.count()).toBe(LIBRARY.length);
    expect((await countAll()).exercises).toBe(0);

    await restoreBackup(backup);
    expect(await db.exercises.count()).toBe(LIBRARY.length + 1);
    expect(await db.exercises.get(mine.id)).toEqual(mine);
    expect(await syncLibrary()).toEqual({ added: 0, updated: 0 });
  });
});
