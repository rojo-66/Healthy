// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DietPlan } from '../../../src/lib/data/schemas/diet-plans';
import { dietPlanSchema } from '../../../src/lib/data/schemas/diet-plans';
import { workoutSchema, type Workout } from '../../../src/lib/data/schemas/workouts';
import { parseHash } from '../../../src/lib/routes';
import { dietFileName } from '../../../src/lib/diet/import/export';
import { sessionFileName } from '../../../src/lib/sessions/share';
import { contentHash, dietToShareFile, shareAuthor, workoutToShareFile } from '../../../src/lib/share/canonical';
import { encodeShare } from '../../../src/lib/share/codec';
import { safeSlug, workoutShareFileName } from '../../../src/lib/share/file-name';
import {
  BACKUP_REJECTED,
  detectShared,
  readSharedFile,
  readSharedText,
  SESSION_REJECTED,
} from '../../../src/lib/share/import/detect';
import { extractImport, isImportHash, payloadFromHash } from '../../../src/lib/share/import/entry';
import { fakeFile, validBackupJson } from '../data/helpers';
import { myDietJson } from '../diet/helpers';
import { ME_OWN, ME_PT, workoutNamed } from '../workouts/helpers';
import sessionFixture from '../../fixtures/session.json';
import { BASE, dietFile, typicalWorkoutFile } from './helpers';

function errorsOf(result: { ok: boolean; errors?: string[] }): string[] {
  expect(result.ok).toBe(false);
  return result.errors ?? [];
}

describe('ingressi: link, codice, JSON', () => {
  it('riconosce link completo, codice da solo, link con a capo e %XX, JSON', () => {
    expect(extractImport(`${BASE}#import=AbC-$+9`)).toEqual({ ok: true, value: { type: 'payload', payload: 'AbC-$+9' } });
    expect(extractImport('  AbC-$+9  ')).toEqual({ ok: true, value: { type: 'payload', payload: 'AbC-$+9' } });
    expect(extractImport(`Ecco la scheda: ${BASE}#import=AbC\n-%249`)).toEqual({
      ok: true,
      value: { type: 'payload', payload: 'AbC-$9' },
    });
    expect(extractImport('{"app":"healthy-app"}')).toEqual({ ok: true, value: { type: 'json', text: '{"app":"healthy-app"}' } });
  });

  it('testo che non è un link di Healthy', () => {
    expect(extractImport('')).toEqual({ ok: false, error: expect.stringMatching(/Incolla/) });
    expect(extractImport('https://example.com/qualcosa')).toEqual({ ok: false, error: expect.stringMatching(/#import=/) });
    expect(extractImport('ciao, come stai?')).toEqual({ ok: false, error: expect.stringMatching(/Non riconosco/) });
  });

  it('#import= non è una rotta; le rotte non sono link di condivisione', () => {
    expect(isImportHash('#import=abc')).toBe(true);
    expect(payloadFromHash('#import=abc')).toBe('abc');
    for (const hash of ['', '#', '#/', '#/allena?id=x', '#/importa', '#importa', '#/import=abc']) {
      expect(isImportHash(hash)).toBe(false);
      expect(payloadFromHash(hash)).toBeNull();
    }
    expect(parseHash('#import=abc')).toBeNull();
    expect(parseHash('#/importa')).toBe('/importa');
  });
});

describe('riconoscimento dal contenuto', () => {
  it('scheda, dieta estesa e file MyDiet', () => {
    const w = detectShared(typicalWorkoutFile());
    expect(w.ok && w.value.kind).toBe('workout');
    const d = detectShared(dietFile());
    expect(d.ok && d.value.kind === 'diet' && d.value.imp.origin).toBe('file');
    const m = detectShared(myDietJson());
    expect(m.ok && m.value.kind === 'diet' && m.value.imp.origin).toBe('mydiet');
  });

  it('backup e sessione rifiutati con il posto giusto', () => {
    expect(errorsOf(detectShared(validBackupJson()))).toEqual([BACKUP_REJECTED]);
    expect(BACKUP_REJECTED).toMatch(/Profilo › Backup e dati/);
    expect(errorsOf(detectShared({ app: 'healthy-app', kind: 'session', schemaVersion: 1, session: sessionFixture }))).toEqual([
      SESSION_REJECTED,
    ]);
  });

  it('app, kind e schemaVersion sbagliati; campi mancanti; testo enorme', () => {
    const file = typicalWorkoutFile() as unknown as Record<string, unknown>;
    expect(errorsOf(detectShared({ ...file, app: 'altra-app' }))[0]).toMatch(/non è stato creato da Healthy/);
    expect(errorsOf(detectShared({ ...file, kind: 'ricetta' }))[0]).toMatch(/Tipo di contenuto sconosciuto/);
    expect(errorsOf(detectShared({ ...file, schemaVersion: 99 }))[0]).toMatch(/versione più recente/);
    const { items: _items, ...noItems } = file;
    expect(errorsOf(detectShared(noItems))).toContain('elementi: campo obbligatorio mancante');
    expect(errorsOf(detectShared({ ...file, intro: 'x'.repeat(5000) }))).toContain('introduzione: testo troppo lungo: massimo 4000 caratteri');
    expect(errorsOf(detectShared({ ...file, items: [{ name: 'X', sets: 3, reps: 1, kg: 0, restSec: 60, videoUrl: 'javascript:alert(1)' }] }))[0]).toMatch(
      /link video/,
    );
    expect(errorsOf(detectShared([1, 2]))[0]).toMatch(/non è una scheda/);
  });

  it('da testo incollato (link) e da file: stesso risultato', async () => {
    const file = typicalWorkoutFile();
    const fromLink = readSharedText(encodeShare(file, BASE).url);
    const fromFile = await readSharedFile(fakeFile(JSON.stringify(file)).file);
    const fromJson = readSharedText(JSON.stringify(file, null, 2));
    expect(fromLink).toEqual(fromFile);
    expect(fromJson).toEqual(fromFile);
    expect(errorsOf(await readSharedFile(fakeFile(JSON.stringify(validBackupJson())).file))).toEqual([BACKUP_REJECTED]);
    expect(errorsOf(readSharedText('{"app": "healthy-app",'))[0]).toMatch(/non è un JSON valido/);
  });
});

/** Riga del database con campi in più (anche annidati) che non devono mai uscire. */
function pollutedWorkout(): Workout {
  const w = workoutSchema.parse(structuredClone(workoutNamed('Petto + Schiena')));
  const extra = {
    ...w,
    personalNote: 'nota privata',
    previousVersions: [{ ...w, version: 2, name: 'Vecchia' }],
    received: { version: 3, hash: '0000abcd', at: '2026-10-01T10:00:00.000Z' },
    items: w.items.map((i) => ({ ...i, secret: 'segreto', userNote: 'dolore al ginocchio' })),
    warmup: w.warmup.map((x) => ({ ...x, done: true })),
  };
  return extra as unknown as Workout;
}

describe('lista bianca dei campi', () => {
  it('scheda: niente cronologia, id interni, note personali o campi inventati', () => {
    const file = workoutToShareFile(pollutedWorkout(), ME_PT);
    const json = JSON.stringify(file);
    for (const forbidden of ['personalNote', 'previousVersions', 'received', 'updatedAt', 'exerciseId', 'secret', 'userNote', 'done', 'Vecchia', 'segreto', 'ginocchio', '0000abcd']) {
      expect(json).not.toContain(forbidden);
    }
    expect(Object.keys(file)).toEqual([
      'app', 'kind', 'schemaVersion', 'id', 'version', 'author', 'source', 'name', 'weekdays', 'time', 'intro', 'warmup', 'items', 'cardio',
    ]);
    expect(Object.keys(file.items[0]!)).toEqual(['name', 'muscles', 'sets', 'reps', 'kg', 'restSec', 'note', 'videoUrl', 'setsDetail']);
  });

  it('dieta: niente stato del telefono (attivo, archivio, import) né campi annidati in più', () => {
    const file = dietFile();
    const plan: DietPlan = dietPlanSchema.parse({
      id: file.id,
      version: file.version,
      title: file.title,
      author: file.author,
      validFrom: file.validFrom,
      active: true,
      archived: false,
      importedAt: '2026-10-11T08:00:00.000Z',
      origin: 'file',
      payload: { dayTypes: file.dayTypes, categories: file.categories, products: file.products, days: file.days, recipes: file.recipes },
    });
    const polluted = structuredClone(plan) as unknown as Record<string, unknown> & { payload: Record<string, unknown> & { days: Record<string, unknown>[] } };
    polluted.notes = 'nota privata';
    polluted.payload.eaten = { colazione: true };
    polluted.payload.days[0]!.diary = 'mangiato fuori';
    const json = JSON.stringify(dietToShareFile(polluted as unknown as DietPlan));
    for (const forbidden of ['importedAt', '"active"', 'archived', '"origin"', 'notes', 'eaten', 'diary', 'mangiato fuori']) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('autore: quello della scheda; per una mia scheda personale il mio nome; mai inventato per una ricevuta', () => {
    const own = workoutSchema.parse({ ...workoutNamed('Braccia') });
    expect(shareAuthor(own, ME_PT)).toBe('Coach Finto');
    expect(shareAuthor(own, ME_OWN)).toBe('');
    expect(shareAuthor({ author: '', received: { version: 1, hash: '00000000', at: '2026-10-01T10:00:00.000Z' } }, ME_PT)).toBe('');
    expect(shareAuthor(workoutNamed('Gambe'), ME_PT)).toBe('PT di prova');
  });

  it('impronta: stessa per lo stesso contenuto, cambia con il contenuto, ignora id e versione', () => {
    const w = workoutNamed('Petto + Schiena');
    expect(contentHash(w)).toMatch(/^[0-9a-f]{8}$/);
    expect(contentHash({ ...w, version: 9, author: 'altro' } as Workout)).toBe(contentHash(w));
    expect(contentHash({ ...w, weekdays: [...w.weekdays].reverse() })).toBe(contentHash(w));
    expect(contentHash({ ...w, intro: `${w.intro}!` })).not.toBe(contentHash(w));
  });
});

describe('nomi dei file', () => {
  it('normalizzati: niente spazi, accenti, emoji o caratteri speciali', () => {
    expect(workoutShareFileName('Pàncà & Dorso 💪 / Gióvedì', 4)).toBe('healthy-scheda-panca-dorso-giovedi-v4.json');
    expect(workoutShareFileName('💪💪', 1)).toBe('healthy-scheda-scheda-v1.json');
    expect(workoutShareFileName('a'.repeat(200), 12)).toBe(`healthy-scheda-${'a'.repeat(40)}-v12.json`);
    expect(workoutShareFileName('../../etc/passwd', 1)).toBe('healthy-scheda-etc-passwd-v1.json');
    expect(dietFileName('Ottobre 2026')).toBe('healthy-dieta-ottobre-2026.json');
    expect(sessionFileName({ workoutName: 'Petto + Schiena', startedAt: '2026-10-12T16:00:00.000Z' })).toBe(
      'healthy-sessione-petto-schiena-2026-10-12.json',
    );
    expect(safeSlug('---', 'x')).toBe('x');
  });
});
