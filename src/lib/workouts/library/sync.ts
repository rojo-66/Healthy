import { db as appDb, type HealthyDb } from '../../data/db';
import { parseOrThrow } from '../../data/errors';
import { exerciseSchema, type Exercise } from '../../data/schemas/exercises';
import { LIBRARY } from './data';

/** Righe della libreria come esercizi del database (`custom: false`, niente video). */
export function libraryExercises(): Exercise[] {
  return LIBRARY.map(([id, name, muscles, equipment]) => ({
    id,
    name,
    muscles: [...muscles],
    equipment,
    videoUrl: null,
    custom: false,
  }));
}

function sameContent(a: Exercise, b: Exercise): boolean {
  return (
    a.name === b.name &&
    a.equipment === b.equipment &&
    a.videoUrl === b.videoUrl &&
    a.muscles.length === b.muscles.length &&
    a.muscles.every((m, i) => m === b.muscles[i])
  );
}

export interface SyncResult {
  added: number;
  updated: number;
}

/**
 * Porta la libreria nel database in modo idempotente: scrive solo le righe mancanti o cambiate
 * (nome, muscoli, attrezzo), in una transazione. Gli esercizi personalizzati non si toccano mai;
 * le righe che la libreria non ha più restano (schede e sessioni possono usarle).
 * Gira all'avvio e all'apertura di Allena/Editor: dopo "Svuota tutto" o un ripristino la libreria torna.
 */
export function syncLibrary(database: HealthyDb = appDb): Promise<SyncResult> {
  const wanted = libraryExercises();
  return database.transaction('rw', database.exercises, async () => {
    const current = new Map((await database.exercises.toArray()).map((row) => [row.id, row]));
    const toPut: Exercise[] = [];
    let added = 0;
    for (const row of wanted) {
      const existing = current.get(row.id);
      if (existing?.custom) continue;
      if (existing && sameContent(existing, row)) continue;
      if (!existing) added++;
      toPut.push(parseOrThrow(exerciseSchema, row));
    }
    if (toPut.length > 0) await database.exercises.bulkPut(toPut);
    return { added, updated: toPut.length - added };
  });
}
