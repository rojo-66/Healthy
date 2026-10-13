import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../src/lib/data/db';
import { deleteRun, listRunLogs, listRuns, saveRun, saveRunLog } from '../../../src/lib/data/repo/runs';
import type { Run, RunLog } from '../../../src/lib/data/schemas/runs';
import { emptyLogForm, emptyRunForm, formDurationSec, formToLog, formToRun, logToForm, runToForm, sameRunForm } from '../../../src/lib/runs/form';
import { kmLabel, paceLabel, paceSecPerKm, runDurationLabel, runLogLabel, runPlannedMinutes, runTag, targetLabel } from '../../../src/lib/runs/format';
import { monthGrid } from '../../../src/lib/sessions/calendar';
import { dayTypeFor } from '../../../src/lib/today/day-type';
import { buildCalendar, type CalendarInput } from '../../../src/lib/calendar/occurrences';
import { weekWorkouts } from '../workouts/helpers';
import { buildTimeline } from '../../../src/lib/today/timeline';
import { runsForDay } from '../../../src/lib/today/workout-day';
import { weekPlan } from '../../../src/lib/workouts/calc/week';
import { weeklyWorkouts } from '../../../src/lib/progress/strength';
import { resetDb } from '../data/helpers';

/** Corsa come attività (2a): pianificata con giorni e obiettivo, segnata come fatta con durata, km, RPE. */

const NOW = new Date(2026, 9, 12, 13, 0); // lunedì 12 ottobre 2026
const TODAY = '2026-10-12';

function run(patch: Partial<Run> = {}): Run {
  return {
    id: 'corsa-1',
    name: 'Corsa lenta',
    weekdays: [3, 6],
    time: '07:00',
    targetMinutes: 30,
    targetKm: 5,
    note: '',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...patch,
  };
}

function log(patch: Partial<RunLog> = {}): RunLog {
  return {
    id: 'fatta-1',
    runId: 'corsa-1',
    runName: 'Corsa lenta',
    date: '2026-10-14',
    loggedAt: '2026-10-14T08:00:00.000Z',
    durationSec: 1930,
    distanceKm: 5.2,
    rpe: 6,
    note: '',
    ...patch,
  };
}

describe('testi e passo', () => {
  it('passo calcolato da durata e km, mai salvato', () => {
    expect(paceSecPerKm(1930, 5.2)).toBeCloseTo(371.15, 1);
    expect(paceLabel(1930, 5.2)).toBe('6:11 /km');
    expect(paceLabel(1660, 5.02, '/km')).toBe('5:31/km');
    expect(paceLabel(1930, null)).toBe('—');
    expect(paceLabel(1930, 0)).toBe('—');
    // Km piccoli: il passo resta leggibile (anche oltre l'ora per km).
    expect(paceLabel(4000, 0.5)).toBe('133:20 /km');
  });

  it('durata, distanza, obiettivo, riga dello storico, sigla', () => {
    expect(runDurationLabel(1660)).toBe('27:40');
    expect(runDurationLabel(3920)).toBe('1:05:20');
    expect(kmLabel(5.02)).toBe('5,02 km');
    expect(targetLabel(run())).toBe('30′ · 5 km');
    expect(targetLabel(run({ targetKm: null }))).toBe('30′');
    expect(targetLabel(run({ targetMinutes: null }))).toBe('5 km');
    expect(runLogLabel(log({ durationSec: 1660, distanceKm: 5.02, rpe: 7 }))).toBe('27:40 · 5,02 km · 5:31/km · RPE 7');
    expect(runLogLabel(log({ distanceKm: null, rpe: null }))).toBe('32:10');
    expect(runPlannedMinutes(run({ targetMinutes: null, targetKm: 8 }))).toBe(48);
    expect(runTag(run({ name: 'Ripetute' }))).toBe('RIP');
  });
});

describe('moduli', () => {
  it('corsa: serve almeno un obiettivo; virgola nei km; errori accanto al campo', () => {
    const base = { id: 'n', createdAt: '2026-10-12T10:00:00.000Z' };
    const empty = formToRun({ ...emptyRunForm(), name: '' }, base, NOW);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors).toEqual({ name: 'Scrivi un nome.', target: 'Indica almeno un obiettivo: minuti o km.' });
    const ok = formToRun({ ...emptyRunForm(), weekdays: [6, 3], targetKm: '5,5' }, base, NOW);
    expect(ok.ok && ok.value).toMatchObject({ name: 'Corsa', weekdays: [3, 6], targetMinutes: null, targetKm: 5.5 });
    const bad = formToRun({ ...emptyRunForm(), targetMinutes: '30,5' }, base, NOW);
    expect(bad.ok || bad.errors.targetMinutes).toBe('Inserisci un numero intero, es. 1720.');
    expect(sameRunForm(runToForm(run()), { ...runToForm(run()), weekdays: [6, 3] })).toBe(true);
  });

  it('corsa fatta: durata obbligatoria, km facoltativi, RPE obbligatorio, data mai nel futuro', () => {
    const base = { id: 'f', runId: 'corsa-1', runName: 'Corsa lenta', loggedAt: '2026-10-12T10:00:00.000Z' };
    const missing = formToLog(emptyLogForm(TODAY), base, TODAY);
    expect(missing.ok || missing.errors).toEqual({
      duration: 'Scrivi la durata: minuti e secondi (da 0 a 59).',
      rpe: 'Scegli quanto è stata faticosa (RPE).',
    });
    const future = formToLog({ ...emptyLogForm('2026-10-13'), minutes: '30', rpe: 5 }, base, TODAY);
    expect(future.ok || future.errors.date).toBe('La data non può essere nel futuro.');
    const ok = formToLog({ ...emptyLogForm(TODAY), minutes: '32', seconds: '10', distanceKm: '5,2', rpe: 6, note: ' ok ' }, base, TODAY);
    expect(ok.ok && ok.value).toEqual({ ...base, date: TODAY, durationSec: 1930, distanceKm: 5.2, rpe: 6, note: 'ok' });
    expect(formDurationSec({ minutes: '', seconds: '75' })).toBeNull();
    expect(formDurationSec({ minutes: '1', seconds: '' })).toBe(60);
    expect(logToForm(log())).toMatchObject({ minutes: '32', seconds: '10', distanceKm: '5,2' });
  });
});

const cal = (patch: Partial<CalendarInput> = {}): CalendarInput => ({
  workouts: [],
  runs: [run()],
  edits: [],
  sessions: [],
  runLogs: [],
  active: null,
  todayIso: TODAY,
  ...patch,
});

/** Corse di un giorno come le calcola la Home (occorrenze + fuori programma). */
function runsOfDay(input: CalendarInput, date: string) {
  const days = buildCalendar(date, date, input);
  return runsForDay(days.occurrences, days.extraLogs);
}

describe('settimana, Home, Storico, Progressi', () => {
  it('settimana di Allena: corse con la loro sigla, fatta = corsa registrata quel giorno', () => {
    const plan = weekPlan(cal({ runLogs: [log()] }));
    const wed = plan.days[2]!;
    expect(wed).toMatchObject({ date: '2026-10-14', state: 'done', tag: 'COR', tagKind: 'run' });
    expect(wed.runs.map((r) => r.name)).toEqual(['Corsa lenta']);
    expect(plan.days[5]).toMatchObject({ state: 'todo', tagKind: 'run' });
    expect(plan.days[0]).toMatchObject({ state: 'rest', tagKind: null });
    // Una corsa passata non fatta.
    const past = weekPlan(cal({ todayIso: '2026-10-16' }));
    expect(past.days[2]?.state).toBe('missed');
    expect(plan.next).toBeNull(); // il "prossimo" resta un allenamento con una scheda
  });

  it('corse del giorno: prevista, fatta, fuori programma', () => {
    const today = runsOfDay(cal(), '2026-10-14');
    expect(today).toEqual([
      expect.objectContaining({
        id: 'run:corsa-1:2026-10-14',
        scheduled: true,
        status: 'todo',
        timeLabel: '07:00–07:30',
        meta: 'obiettivo 30′ · 5 km',
        startMinutes: 420,
      }),
    ]);
    const done = runsOfDay(cal({ runLogs: [log()] }), '2026-10-14');
    expect(done[0]).toMatchObject({ status: 'done', meta: '32:10 · 5,2 km · 6:11/km · RPE 6' });
    const extra = runsOfDay(cal({ runLogs: [log({ id: 'x', runId: null, runName: 'Corsetta', date: '2026-10-12' })] }), '2026-10-12');
    expect(extra).toEqual([expect.objectContaining({ id: 'x', scheduled: false, status: 'done', name: 'Corsetta' })]);
  });

  it('tipo di giornata: senza piano una corsa fa "Corsa"; con palestra e corsa senza scelta, palestra', () => {
    const base = { date: TODAY, payload: null, planType: null, hasActivities: true, choice: null, calendarStart: null };
    expect(dayTypeFor({ ...base, activities: { gym: false, run: true } })).toMatchObject({ key: 'run', label: 'Corsa', tone: 'progress' });
    expect(dayTypeFor({ ...base, activities: { gym: true, run: true } })).toMatchObject({ key: 'gym', double: true });
  });

  it('timeline: la corsa all’orario, in ciano (tipo run)', () => {
    const runs = runsOfDay(cal(), '2026-10-14');
    const items = buildTimeline({ view: null, workouts: [], runs, relation: 'today', nowMinutes: 6 * 60, eaten: {} });
    expect(items).toEqual([{ id: 'run:run:corsa-1:2026-10-14', kind: 'run', label: 'Corsa · Corsa lenta', time: '07:00', state: 'next' }]);
    const during = buildTimeline({ view: null, workouts: [], runs, relation: 'today', nowMinutes: 7 * 60 + 10, eaten: {} });
    expect(during[0]?.state).toBe('now');
  });

  it('calendario dello Storico: corsa ciano, palestra e corsa insieme', () => {
    const cells = monthGrid({ year: 2026, month: 9 }, [{ startedAt: new Date(2026, 9, 5, 18).toISOString(), endedAt: new Date(2026, 9, 5, 19).toISOString() }], NOW, [
      '2026-10-05',
      '2026-10-07',
    ]);
    const byDate = new Map(cells.filter((c) => c.date).map((c) => [c.date, c]));
    expect(byDate.get('2026-10-05')).toMatchObject({ kind: 'both', sessions: 1, runs: 1 });
    expect(byDate.get('2026-10-07')).toMatchObject({ kind: 'run', sessions: 0, runs: 1 });
  });

  it('Progressi: le corse contano negli allenamenti a settimana e nell’obiettivo', () => {
    const range = { from: '2026-10-05', to: '2026-10-18' };
    const gym = { ...weekWorkouts()[0]!, weekdays: [1, 4] };
    const w = weeklyWorkouts([], [gym], range, TODAY, [run()], [log({ date: '2026-10-07' }), log({ id: 'b', date: '2026-10-14' })]);
    expect(w.weeks.map((x) => [x.monday, x.count, x.gym, x.runs, x.target])).toEqual([
      ['2026-10-05', 1, 0, 1, 4],
      ['2026-10-12', 1, 0, 1, 4],
    ]);
  });
});

describe('archivio delle corse', () => {
  beforeEach(resetDb);

  it('salva, elenca, elimina: le corse fatte restano scollegate', async () => {
    await saveRun(run());
    await saveRun(run({ id: 'corsa-2', name: 'Ripetute' }));
    await saveRunLog(log());
    await saveRunLog(log({ id: 'fatta-2', date: '2026-10-07', loggedAt: '2026-10-07T08:00:00.000Z' }));
    expect((await listRuns()).map((r) => r.name)).toEqual(['Corsa lenta', 'Ripetute']);
    expect((await listRunLogs()).map((l) => l.id)).toEqual(['fatta-1', 'fatta-2']);
    await deleteRun('corsa-1');
    expect(await db.runs.get('corsa-1')).toBeUndefined();
    expect((await listRunLogs()).map((l) => [l.runId, l.runName])).toEqual([
      [null, 'Corsa lenta'],
      [null, 'Corsa lenta'],
    ]);
  });

  it('dati non validi: nessuna scrittura', async () => {
    await expect(saveRunLog(log({ durationSec: 0 }))).rejects.toThrow();
    expect(await db.runLogs.count()).toBe(0);
  });
});
