import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from '../../../src/lib/data/errors';
import { sessionFileSchema } from '../../../src/lib/data/schemas/session-file';
import { sessionSchema, type Session } from '../../../src/lib/data/schemas/sessions';
import { upcomingMealKey } from '../../../src/lib/diet/calc/meal-now';
import { addMonths, monthGrid, monthOf, monthSummary, sessionsInMonth } from '../../../src/lib/sessions/calendar';
import { compareWithLast } from '../../../src/lib/sessions/compare';
import { durationShort, groupedNumber, timeRange, volumeLabel } from '../../../src/lib/sessions/format';
import { recordCountsBySession, sessionRecords } from '../../../src/lib/sessions/records';
import { sessionFileName, sessionText, sessionToFile, shareSession } from '../../../src/lib/sessions/share';
import { shouldGoBack } from '../../../src/lib/sessions/edge-swipe';
import { summarize } from '../../../src/lib/sessions/summary';
import historyFixture from '../../fixtures/sessions/history.json';
import inProgressFixture from '../../fixtures/sessions/in-progress.json';

/** 5 lunedì (7/9 → 5/10) con la stessa scheda: PR noti in h2 (panca, lat), h4 (panca, croci); h3 parziale. */
function history(): Session[] {
  return z.array(sessionSchema).parse(structuredClone(historyFixture));
}
const byId = (list: Session[], suffix: number) => list.find((s) => s.id.startsWith(`9e5${String(suffix).padStart(5, '0')}`))!;

describe('record personali (carico a parità di ripetizioni)', () => {
  it('per sessione, solo rispetto alle sessioni concluse prima', () => {
    const all = history();
    const counts = recordCountsBySession(all);
    expect([1, 2, 3, 4, 5].map((n) => counts.get(byId(all, n).id))).toEqual([0, 2, 0, 2, 0]);

    const h2 = sessionRecords(byId(all, 2), all);
    expect([...h2.keys()]).toEqual([0, 1]);
    expect(h2.get(0)).toEqual([0]); // 57,5 × 10 > 55 (max con ≥ 10 rip)
    expect(h2.get(1)).toEqual([1]); // 52,5 × 10 > 50

    const h4 = sessionRecords(byId(all, 4), all);
    expect(h4.get(0)).toEqual([1]); // 62,5 × 8 > 60 (max con ≥ 8 rip)
    expect(h4.get(2)).toEqual([0]); // croci senza id: confronto per nome
  });

  it('nessuno storico = nessun PR; più ripetizioni mai fatte prima = nessun confronto', () => {
    const all = history();
    expect(sessionRecords(byId(all, 1), all).size).toBe(0);
    // h5: serie aggiunta 50 × 12 alla lat, mai fatte ≥ 12 ripetizioni: non è un PR.
    expect(sessionRecords(byId(all, 5), all).size).toBe(0);
  });

  it('a corpo libero (0 kg) mai PR; le sessioni in corso non fanno storico', () => {
    const all = history();
    const s = structuredClone(byId(all, 5));
    s.id = 'nuova';
    s.startedAt = '2026-10-12T16:00:00.000Z';
    s.endedAt = '2026-10-12T17:00:00.000Z';
    s.sets = s.sets.map((x) => (x.itemIndex === 0 ? { ...x, kg: 0, reps: 20 } : x));
    expect(sessionRecords(s, all).has(0)).toBe(false);

    const running = { ...structuredClone(byId(all, 1)), id: 'run', startedAt: '2026-08-01T10:00:00.000Z', endedAt: null };
    const withRunning = [running, ...all];
    expect(recordCountsBySession(withRunning).has('run')).toBe(false);
    expect(sessionRecords(byId(all, 1), withRunning).size).toBe(0);
  });
});

describe('confronto con l’ultima volta', () => {
  it('meglio (ciano), uguale, serie mancanti (giallo), prima volta', () => {
    const all = history();
    // Serie migliore = la più pesante: lat 52,5 × 10 contro 50 × 10.
    expect(compareWithLast(byId(all, 2), 1, byId(all, 1))).toEqual({ kind: 'up', text: '+2,5 kg' });
    expect(compareWithLast(byId(all, 2), 0, byId(all, 1))).toEqual({ kind: 'same', text: '=' }); // 65 × 6 in entrambe
    expect(compareWithLast(byId(all, 5), 0, byId(all, 4))).toEqual({ kind: 'same', text: '=' });
    expect(compareWithLast(byId(all, 3), 0, byId(all, 2))).toEqual({ kind: 'warn', text: '−1 serie' });
    expect(compareWithLast(byId(all, 3), 2, byId(all, 2))).toEqual({ kind: 'warn', text: '−2 serie' });
    expect(compareWithLast(byId(all, 1), 0, null)).toEqual({ kind: 'first', text: 'prima volta' });
    // h4 croci 17,5 × 12 contro h3 (croci non fatte): nessun termine di paragone.
    expect(compareWithLast(byId(all, 4), 2, byId(all, 3)).kind).toBe('first');
    // Stessi kg, più ripetizioni.
    const more = structuredClone(byId(all, 5));
    more.sets = more.sets.map((x) => (x.itemIndex === 2 ? { ...x, reps: 14 } : x));
    expect(compareWithLast(more, 2, byId(all, 4))).toEqual({ kind: 'up', text: '+2 rip' });
    expect(compareWithLast(byId(all, 4), 0, more).kind).toBe('same');
  });
});

describe('riepilogo della sessione', () => {
  it('numeri, PR, serie saltate, note, cardio', () => {
    const all = history();
    const s3 = summarize(byId(all, 3), byId(all, 2), all);
    expect(s3.durationSec).toBe(66 * 60);
    expect(s3.done).toBe(4);
    expect(s3.planned).toBe(7);
    expect(s3.skipped).toBe(3);
    expect(s3.volume).toBe(57.5 * 10 + 60 * 8 + 52.5 * 10 + 52.5 * 8);
    expect(s3.readinessTotal).toBe(13);
    // 2a: il cardio è un esercizio del riepilogo (qui non fatto); non conta nelle serie.
    expect([s3.cardioDone, s3.cardioTotal]).toEqual([0, 1]);
    expect(s3.exercises[3]).toMatchObject({
      kind: 'cardio',
      name: 'Tapis roulant · corsa',
      cardio: { plannedMin: 12, minutes: null, distanceKm: null, done: false },
    });
    expect(s3.exercises[0]?.sets.map((x) => x.text)).toEqual(['57,5 × 10', '60 × 8', 'saltata']);
    expect(s3.exercises[2]?.note).toBe('Croci saltate: spalla stanca.');

    const s4 = summarize(byId(all, 4), byId(all, 3), all);
    expect(s4.records).toBe(2);
    expect(s4.recordNames).toEqual(['Panca piana con bilanciere', 'Croci ai cavi']);
    expect(s4.exercises[0]?.sets.find((x) => x.pr)?.text).toBe('62,5 × 8');

    // Serie aggiunta e fatta: conta tra le fatte (8/7) e compare come "in più".
    const s5 = summarize(byId(all, 5), byId(all, 4), all);
    expect([s5.done, s5.planned, s5.skipped]).toEqual([8, 7, 0]);
    expect(s5.exercises[1]?.sets.at(-1)).toMatchObject({ text: '50 × 12', extra: true });
    // Cardio fatto (migrato da `cardioDone`): minuti del piano, segnato fatto.
    expect(s5.exercises[3]?.cardio).toMatchObject({ plannedMin: 12, done: true });
  });
});

describe('calendario e riepilogo del mese', () => {
  const today = new Date(2026, 9, 12, 13, 0);

  it('ottobre 2026: parte di giovedì, oggi evidenziato, palestra/riposo/futuro', () => {
    const all = history();
    const cells = monthGrid(monthOf(today), all, today);
    expect(cells.slice(0, 3).every((c) => c.date === null)).toBe(true);
    expect(cells[3]).toMatchObject({ date: '2026-10-01', day: 1, kind: 'rest' });
    const byDate = new Map(cells.filter((c) => c.date).map((c) => [c.date, c]));
    expect(byDate.get('2026-10-05')).toMatchObject({ kind: 'gym', sessions: 1 });
    expect(byDate.get('2026-10-12')).toMatchObject({ kind: 'rest', isToday: true });
    expect(byDate.get('2026-10-13')?.kind).toBe('future');
    expect(cells.filter((c) => c.date)).toHaveLength(31);
  });

  it('mese che inizia di lunedì, navigazione, sessioni in corso escluse', () => {
    const all = [...history(), sessionSchema.parse(structuredClone(inProgressFixture))];
    const sept = addMonths(monthOf(today), -1);
    expect(sept).toEqual({ year: 2026, month: 8 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    const cells = monthGrid(sept, all, today);
    expect(cells[0]?.date).toBeNull(); // 1 settembre 2026 è martedì: una casella vuota prima
    expect(cells[1]).toMatchObject({ date: '2026-09-01' });
    const sepCells = monthGrid({ year: 2025, month: 8 }, all, today);
    expect(sepCells[0]?.date).toBe('2025-09-01'); // 1 settembre 2025 è lunedì
    expect(cells.filter((c) => c.kind === 'gym').map((c) => c.date)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);

    const records = recordCountsBySession(all);
    expect(monthSummary(all, sept, records)).toEqual({ sessions: 4, records: 4 });
    expect(monthSummary(all, monthOf(today), records)).toEqual({ sessions: 1, records: 0 });
    expect(sessionsInMonth(all, sept).map((s) => s.startedAt.slice(0, 10))).toEqual([
      '2026-09-28',
      '2026-09-21',
      '2026-09-14',
      '2026-09-07',
    ]);
    // La sessione in corso del 12/10 non colora il giorno.
    expect(monthGrid(monthOf(today), all, today).find((c) => c.date === '2026-10-12')?.kind).toBe('rest');
  });
});

describe('formati', () => {
  it('migliaia, volume, durata breve, orari', () => {
    expect(groupedNumber(7775)).toBe('7.775');
    expect(groupedNumber(2227.5)).toBe('2.227,5');
    expect(groupedNumber(660)).toBe('660');
    expect(groupedNumber(1234567.891)).toBe('1.234.567,89');
    expect(volumeLabel(0)).toBe('0 kg');
    expect(durationShort(76 * 60 + 40)).toBe('1:16');
    expect(durationShort(45 * 60 + 59)).toBe('45’');
    const start = new Date(2026, 9, 12, 18, 2).toISOString();
    const end = new Date(2026, 9, 12, 19, 18).toISOString();
    expect(timeRange(start, end)).toBe('18:02 → 19:18');
    expect(timeRange(start, null)).toBe('dalle 18:02');
  });
});

describe('Invia al PT', () => {
  it('file kind "session" valido, senza stato in corso; sessione in corso rifiutata', () => {
    const s = history()[3]!;
    const file = sessionToFile(s, new Date('2026-10-12T17:00:00.000Z'));
    expect(file).toMatchObject({ app: 'healthy-app', kind: 'session', schemaVersion: 2, exportedAt: '2026-10-12T17:00:00.000Z' });
    expect(file.session.snapshot?.items).toHaveLength(4);
    expect(file.session).not.toHaveProperty('cardioDone');
    expect(validate(sessionFileSchema, JSON.parse(JSON.stringify(file))).ok).toBe(true);
    expect(sessionFileName(s)).toBe('healthy-sessione-spinta-finta-2026-09-28.json');

    const running = sessionSchema.parse(structuredClone(inProgressFixture));
    expect(() => sessionToFile(running)).toThrow(/non è conclusa/);
    const bad = { ...file, kind: 'workout' };
    expect(validate(sessionFileSchema, bad).ok).toBe(false);
  });

  it('testo leggibile per il PT', () => {
    const all = history();
    const s = byId(all, 3);
    const text = sessionText(s, summarize(s, byId(all, 2), all));
    expect(text.split('\n').slice(0, 4)).toEqual([
      'Spinta finta · v2',
      expect.stringMatching(/^Lun 21 set 2026 · \d\d:\d\d → \d\d:\d\d \(1:06:00\)$/),
      'Readiness 13/25 (sonno 2, umore 3, energia 2, stress 3, affaticamento 3)',
      'Volume 2.000 kg · Serie 4/7 · Cardio 0/1 · RPE 9/10',
    ]);
    expect(text).toContain('1. Panca piana con bilanciere — 2/3 · top 60 × 8');
    expect(text).toContain('   57,5 × 10 · 60 × 8 · saltata');
    expect(text).toContain('   Nota: Croci saltate: spalla stanca.');
    expect(text).toContain('4. Tapis roulant · corsa — cardio non fatto (previsti 12’)');
    expect(text).not.toMatch(/[<>]/);
  });

  it('condivisione: file + testo, solo testo, annullata, gesto scaduto, non disponibile', async () => {
    const file = new File(['{}'], 'x.json', { type: 'application/json' });
    const data = { title: 'T', text: 'testo', file };
    const shared: ShareData[] = [];
    const share = async (d: ShareData) => {
      shared.push(d);
    };
    expect(await shareSession(data, { canShare: () => true, share })).toBe('shared-file');
    expect(shared[0]?.files).toEqual([file]);
    expect(shared[0]?.text).toBe('testo');
    expect(await shareSession(data, { canShare: () => false, share })).toBe('shared-text');
    expect(shared[1]?.files).toBeUndefined();
    const fail = (name: string) => async () => {
      throw Object.assign(new Error(name), { name });
    };
    expect(await shareSession(data, { canShare: () => true, share: fail('AbortError') })).toBe('cancelled');
    expect(await shareSession(data, { canShare: () => true, share: fail('NotAllowedError') })).toBe('needs-gesture');
    expect(await shareSession(data, {})).toBe('unsupported');
  });
});

describe('prossimo pasto e swipe indietro', () => {
  const meal = (key: string, time: string | null, window: [string, string] | null = null, empty = false) => ({
    key,
    label: key,
    time,
    window,
    name: empty ? '' : key,
    recipe: null,
    items: empty ? [] : [{ p: 'x', q: 1 }],
  });

  it('il pasto del momento, altrimenti il prossimo non mangiato', () => {
    const meals = [meal('pranzo', '13:00'), meal('spuntino', null, ['16:30', '17:30']), meal('vuoto', '19:00', null, true), meal('cena', '21:00')];
    expect(upcomingMealKey(meals, {}, 17 * 60)).toBe('spuntino');
    expect(upcomingMealKey(meals, {}, 18 * 60)).toBe('cena');
    expect(upcomingMealKey(meals, { cena: true }, 18 * 60 + 30)).toBeNull();
    expect(upcomingMealKey(meals, { spuntino: true }, 16 * 60)).toBe('pranzo'); // il pranzo dura fino alle 16:30
    expect(upcomingMealKey(meals, { pranzo: true, spuntino: true }, 16 * 60)).toBe('cena');
  });

  it('swipe dal bordo: oltre un terzo o con un colpo veloce', () => {
    expect(shouldGoBack(140, 0, 390)).toBe(true);
    expect(shouldGoBack(100, 0.2, 390)).toBe(false);
    expect(shouldGoBack(60, 0.8, 390)).toBe(true);
    expect(shouldGoBack(30, 2, 390)).toBe(false);
    expect(shouldGoBack(-200, 3, 390)).toBe(false);
  });
});
