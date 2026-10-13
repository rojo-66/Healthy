import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sessionSchema, type Session } from '../../../src/lib/data/schemas/sessions';
import { periodRange } from '../../../src/lib/progress/period';
import {
  exerciseChoices,
  exerciseView,
  recentRecords,
  strengthIndex,
  weeklyWorkouts,
} from '../../../src/lib/progress/strength';
import { recordCountsBySession, recordTimeline, sessionRecords } from '../../../src/lib/sessions/records';
import historyFixture from '../../fixtures/sessions/history.json';
import { progressTables, TODAY } from './helpers';

const BENCH = 'id:fx-barbell-bench-press-medium-grip';
const LAT = 'id:fx-wide-grip-lat-pulldown';

describe('record personali su tutto lo storico (refactor M5)', () => {
  const history = z.array(sessionSchema).parse(structuredClone(historyFixture));

  it('recordTimeline dà le stesse serie di sessionRecords, sessione per sessione', () => {
    const timeline = recordTimeline(history);
    for (const session of history) {
      const fromTimeline = new Map<number, number[]>();
      for (const r of timeline.get(session.id) ?? []) fromTimeline.set(r.itemIndex, [...(fromTimeline.get(r.itemIndex) ?? []), r.setIndex]);
      expect(fromTimeline).toEqual(sessionRecords(session, history));
    }
  });

  it('i conteggi dello Storico non cambiano: [0, 2, 0, 2, 0]', () => {
    const counts = recordCountsBySession(history);
    expect(history.map((s) => counts.get(s.id))).toEqual([0, 2, 0, 2, 0]);
  });

  it('ogni record porta il valore precedente superato', () => {
    const all = [...recordTimeline(history).values()].flat();
    expect(all.length).toBeGreaterThan(0);
    for (const r of all) expect(r.kg).toBeGreaterThan(r.previousKg);
  });
});

describe('tab Forza', () => {
  const t = progressTables();
  const index = strengthIndex(t.sessions);
  const all = periodRange('all', TODAY, '2026-07-13');

  it('esercizi da scegliere: almeno 2 sessioni con carico (niente plank a 0 kg, niente esercizio fatto una volta)', () => {
    const keys = exerciseChoices(index).map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining([BENCH, LAT, 'name:croci ai cavi', 'name:leg press']));
    expect(keys).not.toContain('id:fx-plank');
    expect(keys).not.toContain('name:curl manubri finto');
    expect(index.get('name:curl manubri finto')?.points).toHaveLength(1);
  });

  it('2a: i cardio (migrati dal vecchio cardio finale) non compaiono nella Forza né nei chip', () => {
    // Le sessioni di prova hanno il cardio come ultimo esercizio.
    expect(t.sessions.some((s) => s.snapshot?.items.some((i) => i.kind === 'cardio'))).toBe(true);
    const cardioKeys = [...index.keys()].filter((k) => k.startsWith('id:cd-') || k.includes('tapis') || k.includes('cyclette'));
    expect(cardioKeys).toEqual([]);
    expect(exerciseChoices(index).every((h) => !h.key.startsWith('id:cd-'))).toBe(true);
  });

  it('serie migliore e volume per sessione; record con il valore precedente', () => {
    const bench = index.get(BENCH)!;
    const last = bench.points.at(-1)!;
    expect(last).toMatchObject({ date: '2026-10-12', kg: 77.5, reps: 6, volume: 70 * 10 + 75 * 8 + 77.5 * 6 });
    expect(last.record).toMatchObject({ kg: 77.5, reps: 6, previousKg: 75 });
    const first = bench.points[0]!;
    expect(first).toMatchObject({ date: '2026-07-13', kg: 60, reps: 8, record: null });
    expect(bench.points.find((p) => p.date === '2026-07-27')?.record).toMatchObject({ kg: 62.5, previousKg: 60 });
  });

  it('una sessione senza serie fatte per un esercizio non crea un punto (mai zero)', () => {
    expect(index.get(LAT)?.points.some((p) => p.date === '2026-09-03')).toBe(false);
    expect(index.get(BENCH)?.points.some((p) => p.date === '2026-09-03')).toBe(true);
  });

  it('a parità di carico vince la serie con più ripetizioni; esercizio ripetuto nella sessione: un punto solo', () => {
    const base = t.sessions[0]!;
    const twice: Session = {
      ...base,
      id: 'doppia',
      startedAt: '2026-10-13T16:00:00.000Z',
      endedAt: '2026-10-13T17:00:00.000Z',
      snapshot: { items: [base.snapshot!.items[0]!, base.snapshot!.items[0]!] },
      cardio: [],
      sets: [
        { exerciseId: base.snapshot!.items[0]!.exerciseId, itemIndex: 0, setIndex: 0, kg: 80, reps: 5, done: true },
        { exerciseId: base.snapshot!.items[0]!.exerciseId, itemIndex: 1, setIndex: 0, kg: 80, reps: 7, done: true },
        { exerciseId: base.snapshot!.items[0]!.exerciseId, itemIndex: 1, setIndex: 1, kg: 90, reps: 1, done: false },
      ],
    };
    const points = strengthIndex([twice]).get(BENCH)!.points;
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ kg: 80, reps: 7, volume: 80 * 5 + 80 * 7 });
  });

  it('vista dell\'esercizio: carico o volume, tre numeri, variazione nel periodo', () => {
    const load = exerciseView(index.get(BENCH), 'load', all);
    expect(load.sessions).toBe(index.get(BENCH)!.points.length);
    expect(load.best).toMatchObject({ kg: 77.5, reps: 6 });
    expect(load.records).toBeGreaterThanOrEqual(5);
    expect(load.delta).toBe(17.5);
    const vol = exerciseView(index.get(BENCH), 'volume', all);
    expect(vol.series.at(-1)?.value).toBe(1765);
    expect(vol.best?.volume).toBe(Math.max(...index.get(BENCH)!.points.map((p) => p.volume)));
    const four = exerciseView(index.get(BENCH), 'load', periodRange('4w', TODAY, '2026-07-13'));
    expect(four.points.every((p) => p.date >= '2026-09-21')).toBe(true);
    expect(exerciseView(undefined, 'load', all)).toMatchObject({ sessions: 0, best: null, delta: null });
  });

  it('allenamenti per settimana: settimane a zero, settimana in corso, obiettivo dalle schede', () => {
    const { weeks, hasTarget } = weeklyWorkouts(t.sessions, t.workouts, all, TODAY);
    expect(hasTarget).toBe(true);
    expect(weeks.every((w) => w.target === 3)).toBe(true);
    expect(weeks).toHaveLength(14);
    expect(weeks.find((w) => w.monday === '2026-08-10')).toMatchObject({ count: 0, volumeKg: 0 });
    expect(weeks.find((w) => w.monday === '2026-09-14')?.count).toBe(2);
    expect(weeks.at(-1)).toMatchObject({ monday: '2026-10-12', count: 1, current: true });
    expect(weeks.filter((w) => w.current)).toHaveLength(1);
    expect(weeks[0]?.volumeKg).toBeGreaterThan(0);
  });

  it('senza schede con giorni niente obiettivo; senza dati nessuna settimana', () => {
    const none = weeklyWorkouts(t.sessions, [{ ...t.workouts[0]!, weekdays: [] }], all, TODAY);
    expect(none.hasTarget).toBe(false);
    expect(none.weeks.every((w) => w.target === null)).toBe(true);
    expect(weeklyWorkouts([], [], null, TODAY)).toEqual({ weeks: [], hasTarget: false });
  });

  it('record recenti del periodo, dal più recente, con il valore precedente', () => {
    const list = recentRecords(index, all, 3);
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ key: BENCH, date: '2026-10-12', kg: 77.5, reps: 6, previousKg: 75 });
    for (let i = 1; i < list.length; i++) expect(list[i - 1]!.date >= list[i]!.date).toBe(true);
    expect(recentRecords(index, null)).toEqual([]);
  });
});

describe('ordine dei chip', () => {
  it('a parità di sessioni vince il più recente, poi l\'ordine nella scheda (panca prima delle croci)', () => {
    const keys = exerciseChoices(strengthIndex(progressTables().sessions)).map((h) => h.key);
    expect(keys.indexOf(BENCH)).toBeLessThan(keys.indexOf('name:croci ai cavi'));
    expect(keys[0]).toBe(BENCH);
  });
});
