// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_BYTES } from '../../../src/lib/data/limits';
import { readDietFile, readJsonFile, readWorkoutFile } from '../../../src/lib/data/read-file';
import dietFixture from '../../fixtures/diet.json';
import broken from '../../fixtures/invalid/broken.json?raw';
import workoutFixture from '../../fixtures/workout.json';
import { fakeFile } from './helpers';

describe('readJsonFile', () => {
  it('legge un JSON valido', async () => {
    const { file } = fakeFile('{"a":1}');
    expect(await readJsonFile(file, 100)).toEqual({ ok: true, value: { a: 1 } });
  });

  it('file troppo grande: rifiutato senza leggerlo', async () => {
    const { file, text } = fakeFile('{}', MAX_BYTES.share + 1);
    const result = await readJsonFile(file, MAX_BYTES.share);
    expect(result).toEqual({ ok: false, errors: ['Il file è troppo grande (1 MB): il massimo è 1 MB.'] });
    expect(text).not.toHaveBeenCalled();
  });

  it('dimensione dichiarata falsa: controllata anche sul contenuto', async () => {
    const { file } = fakeFile('x'.repeat(200), 10);
    expect(await readJsonFile(file, 100)).toEqual({ ok: false, errors: ['Il file è troppo grande: il massimo è 0 MB.'] });
  });

  it('file vuoto', async () => {
    const { file } = fakeFile('');
    expect(await readJsonFile(file, 100)).toEqual({ ok: false, errors: ['Il file è vuoto.'] });
  });

  it('JSON rotto', async () => {
    const { file } = fakeFile(broken);
    expect(await readJsonFile(file, MAX_BYTES.backup)).toEqual({
      ok: false,
      errors: ['Il file non è un JSON valido: forse è danneggiato o non è un file di Healthy.'],
    });
  });

  it('lettura fallita', async () => {
    const file = { size: 10, text: () => Promise.reject(new Error('io')) };
    expect(await readJsonFile(file, 100)).toEqual({ ok: false, errors: ['Impossibile leggere il file.'] });
  });

  it('chiave __proto__ rifiutata', async () => {
    const { file } = fakeFile('{"products":{"__proto__":{"polluted":true}}}');
    expect(await readJsonFile(file, 1000)).toEqual({
      ok: false,
      errors: ['Il file contiene una chiave non ammessa («__proto__»).'],
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('readWorkoutFile / readDietFile', () => {
  it('leggono e validano i file condivisi', async () => {
    expect((await readWorkoutFile(fakeFile(JSON.stringify(workoutFixture)).file)).ok).toBe(true);
    expect((await readDietFile(fakeFile(JSON.stringify(dietFixture)).file)).ok).toBe(true);
  });

  it('una dieta passata come scheda viene riconosciuta', async () => {
    const result = await readWorkoutFile(fakeFile(JSON.stringify(dietFixture)).file);
    expect(result).toEqual({ ok: false, errors: ['Questo file è un piano alimentare, non una scheda.'] });
  });
});
