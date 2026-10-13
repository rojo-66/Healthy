import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TABLE_NAMES } from '../../../src/lib/data/schemas';
import type { WorkoutAuthor } from '../../../src/lib/data/schemas/workout-draft';
import { buildShoppingList, shoppingShareText } from '../../../src/lib/diet/calc/shopping';
import { planExportFile, planToDietFile } from '../../../src/lib/diet/import/export';
import { adherenceSummary, dietDays } from '../../../src/lib/progress/diet';
import { bodySeries } from '../../../src/lib/progress/body';
import { recentRecords, strengthIndex } from '../../../src/lib/progress/strength';
import { sessionExportFile, sessionText, sessionToFile } from '../../../src/lib/sessions/share';
import { summarize } from '../../../src/lib/sessions/summary';
import { dietToShareFile, workoutToShareFile } from '../../../src/lib/share/canonical';
import { decodePayload } from '../../../src/lib/share/codec';
import { prepareDietShare, prepareWorkoutShare } from '../../../src/lib/share/prepare';
import { progressTables, TODAY } from '../progress/helpers';
import { BASE } from './helpers';

/**
 * SPEC § 8.4 e regola di M9: si condividono solo schede e diete. I dati di Progressi (misure, diario
 * della dieta, storico delle sessioni e tutto ciò che se ne calcola) non devono mai finire in un file,
 * in un link o in un QR (il QR contiene il link).
 */

const ME: WorkoutAuthor = { name: 'Coach Finto', lastSource: 'pt' };

/** Dati di Progressi con valori "sentinella" facili da cercare nei risultati. */
function trackedData() {
  const t = progressTables();
  const measurements = t.measurements.map((m, i) => ({
    ...m,
    weightKg: i === 0 ? 123.45 : m.weightKg,
    notes: i === 0 ? 'SENTINELLA-MISURA' : m.notes,
  }));
  const active = t.dietPlans.find((p) => p.active)!;
  const dietLog = t.dietLog;
  const sessions = t.sessions;
  const index = strengthIndex(sessions);
  const records = recentRecords(index, { from: '2026-01-01', to: TODAY }, 10);
  const adherence = adherenceSummary(dietDays(t.dietPlans, dietLog, TODAY));
  const body = bodySeries(measurements, t.profile[0]);
  return { t, measurements, active, dietLog, sessions, records, adherence, body };
}

/** Testi che non devono comparire in nessun contenuto condiviso. */
function forbiddenStrings(d: ReturnType<typeof trackedData>, ownSessionId?: string): string[] {
  return [
    'SENTINELLA-MISURA',
    '123.45',
    '123,45',
    'weightKg',
    'measurements',
    'dietLog',
    'swappedFromWeekday',
    'mealsFrom',
    '"eaten"',
    'previousKg',
    'adherence',
    'ADERENZA',
    // 2a: corse fatte e pianificate restano sul telefono
    'runLogs',
    'runName',
    'durationSec',
    'targetMinutes',
    // id delle sessioni (lo storico), tranne quella mandata al PT con "Invia al PT" (M5)
    ...d.sessions.map((s) => s.id).filter((id) => id !== ownSessionId),
    // date del diario: compaiono solo nei dati di Progressi
    ...d.dietLog.map((l) => `"date":"${l.date}"`),
  ];
}

function expectClean(text: string, forbidden: readonly string[]) {
  for (const f of forbidden) expect(text, `trovato «${f}»`).not.toContain(f);
}

describe('i dati di Progressi non escono mai dal telefono', () => {
  const d = trackedData();
  const forbidden = forbiddenStrings(d);

  it('scheda: file, link (anche decodificato) e QR (contiene il link)', async () => {
    for (const w of d.t.workouts) {
      expectClean(JSON.stringify(workoutToShareFile(w, ME)), forbidden);
      const share = prepareWorkoutShare(w, ME, BASE);
      expectClean(await share.file.text(), forbidden);
      expectClean(share.url, forbidden);
      const decoded = decodePayload(share.payload);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expectClean(JSON.stringify(decoded.value), forbidden);
    }
  });

  it('dieta: file condiviso, file esportato, link', async () => {
    expectClean(JSON.stringify(dietToShareFile(d.active)), forbidden);
    expectClean(JSON.stringify(planToDietFile(d.active)), forbidden);
    expectClean(await planExportFile(d.active).text(), forbidden);
    const share = prepareDietShare(d.active, BASE);
    expectClean(await share.file.text(), forbidden);
    const decoded = decodePayload(share.payload);
    if (decoded.ok) expectClean(JSON.stringify(decoded.value), forbidden);
  });

  it('"Invia al PT": solo quella sessione, niente storico, record calcolati, misure o diario', async () => {
    const session = d.sessions.at(-1)!;
    const own = forbiddenStrings(d, session.id);
    expectClean(JSON.stringify(sessionToFile(session)), own);
    expectClean(await sessionExportFile(session).text(), own);
    const summary = summarize(session, d.sessions.at(-2) ?? null, d.sessions);
    expectClean(sessionText(session, summary), own);
  });

  it('lista della spesa condivisa come testo', () => {
    const list = buildShoppingList(d.active.payload);
    expectClean(shoppingShareText(list, {}, '12–18 ott'), forbidden);
  });

  it('Progressi non salva niente: le tabelle del database (e quindi del backup) sono quelle di sempre', () => {
    // 2a: le tabelle della corsa (pianificata e fatta); 2c: quelle del calendario. Nessuna la scrive Progressi.
    expect([...TABLE_NAMES].sort()).toEqual(
      [
        'calendarEdits',
        'dayChoices',
        'dietLog',
        'dietPlans',
        'exercises',
        'measurements',
        'profile',
        'runLogs',
        'runs',
        'sessions',
        'settings',
        'shopping',
        'workouts',
      ].sort(),
    );
    // I calcoli esistono davvero (il controllo sopra non è vuoto per caso).
    expect(d.records.length).toBeGreaterThan(0);
    expect(d.adherence.average).not.toBeNull();
    expect(d.body.weight[0]?.value).toBe(123.45);
  });

  it('nessun modulo di condivisione importa Progressi o i grafici (nemmeno indirettamente)', () => {
    const root = resolve(__dirname, '../../..');
    const entries = [
      'src/lib/share/canonical.ts',
      'src/lib/share/prepare.ts',
      'src/lib/share/codec.ts',
      'src/lib/share/qr/encode.ts',
      'src/lib/sessions/share.ts',
      'src/lib/diet/import/export.ts',
      'src/lib/diet/calc/shopping.ts',
      'src/lib/data/backup.ts',
      'src/routes/share/ShareSheet.svelte',
      'src/routes/share/QrCode.svelte',
    ].map((p) => join(root, p));

    const seen = new Set<string>();
    const stack = [...entries];
    while (stack.length > 0) {
      const file = stack.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      for (const [, spec] of source.matchAll(/(?:from|import)\s*\(?\s*'(\.[^']+)'/g)) {
        const base = resolve(dirname(file), spec!);
        const found = [base, `${base}.ts`, `${base}/index.ts`].find((p) => existsSync(p) && !p.endsWith('/'));
        if (found && /\.(ts|svelte)$/.test(found)) stack.push(found);
      }
    }
    const reached = [...seen].map((p) => p.replaceAll('\\', '/'));
    expect(reached.length).toBeGreaterThan(entries.length);
    expect(reached.filter((p) => p.includes('/src/lib/progress/') || p.includes('/src/lib/charts/'))).toEqual([]);
    // 2a: corse pianificate e fatte non si condividono mai (né la logica né il loro archivio).
    const sharing = reached.filter((p) => !p.endsWith('/src/lib/data/backup.ts'));
    expect(sharing.filter((p) => p.includes('/src/lib/runs/') || p.includes('/src/lib/data/repo/runs'))).toEqual([]);
    // 2c: nemmeno il calendario (spostamenti, salti, diete scelte).
    expect(sharing.filter((p) => p.includes('/src/lib/calendar/') || p.includes('/src/lib/data/repo/calendar'))).toEqual([]);
  });
});

describe('calendario (2c): spostamenti, salti, diete scelte e corse fatte non si condividono mai', () => {
  const d = trackedData();
  /** Nomi dei campi del calendario: non devono comparire in nessun file, link o testo condiviso. */
  const calendarFields = ['calendarEdits', 'dayChoices', 'mealSources', 'calendarStart', 'originalDate', 'toDate', 'dietType', 'runLogs'];

  it('schede, diete, sessioni e spesa (anche dopo gli spostamenti) senza dati del calendario', async () => {
    for (const w of d.t.workouts) {
      expectClean(JSON.stringify(workoutToShareFile(w, ME)), calendarFields);
      expectClean(await prepareWorkoutShare(w, ME, BASE).file.text(), calendarFields);
    }
    expectClean(JSON.stringify(dietToShareFile(d.active)), calendarFields);
    expectClean(await planExportFile(d.active).text(), calendarFields);
    const session = d.sessions.at(-1)!;
    expectClean(JSON.stringify(sessionToFile(session)), calendarFields);
    const moved = buildShoppingList(d.active.payload, ['rest', 'gym', 'gym', 'rest', 'gym', 'run', 'rest'].map((type) => ({ type })));
    expectClean(shoppingShareText(moved, {}, '12–18 ott'), calendarFields);
  });
});
