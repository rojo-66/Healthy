import { describe, expect, it } from 'vitest';
import { toMinutes } from '../../../src/lib/diet/calc/meal-now';
import { dayInfo, dayInfos } from '../../../src/lib/calendar/days';
import { buildCalendar, type CalendarInput } from '../../../src/lib/calendar/occurrences';
import type { CalendarEdit, DayChoice } from '../../../src/lib/data/schemas/calendar';
import type { DietLogDay } from '../../../src/lib/data/schemas/diet-log';
import type { DietPlan } from '../../../src/lib/data/schemas/diet-plans';
import type { Run, RunLog } from '../../../src/lib/data/schemas/runs';
import type { Session } from '../../../src/lib/data/schemas/sessions';
import type { Workout } from '../../../src/lib/data/schemas/workouts';
import { buildHomeDay, homeStrip, relationOf, relativeDayWord, weekDates } from '../../../src/lib/today/home';
import { isSyncOk, syncStatus, type SyncInputs } from '../../../src/lib/today/sync';
import { dailyTip, GENERIC_TIPS, genericTipsFor } from '../../../src/lib/today/tips';
import { inTimeLabel, workoutWhen } from '../../../src/lib/today/workout-day';
import { workoutTotals } from '../../../src/lib/workouts/calc/duration';
import { weekWorkouts, workoutNamed } from '../workouts/helpers';
import { extendedPlan, partialPlan, sessionOf, swapLogs, TODAY } from './helpers';

const at = (hhmm: string) => toMinutes(hhmm);

interface HomeCase {
  date: string;
  todayIso: string;
  nowMinutes: number;
  plan: DietPlan | null;
  log: DietLogDay | undefined;
  workouts: Workout[];
  sessions: Session[];
  active: Session | null;
  runs: Run[];
  runLogs: RunLog[];
  edits: CalendarEdit[];
  choices: DayChoice[];
  /**
   * Primo giorno con il tipo dalle attività (2c). Qui di base nel futuro: questi test verificano la Home con il tipo
   * del piano, come prima del 2c; il tipo dalle attività ha i suoi test (`day-type.test.ts`).
   */
  calendarStart: string | null;
}

/** Giorno della Home come lo calcola la schermata: calendario del giorno, tipo di giornata, diario. */
function home(overrides: Partial<HomeCase> = {}) {
  const c: HomeCase = {
    date: TODAY,
    todayIso: TODAY,
    nowMinutes: at('13:00'),
    plan: extendedPlan(),
    log: undefined,
    workouts: weekWorkouts(),
    sessions: [],
    active: null,
    runs: [],
    runLogs: [],
    edits: [],
    choices: [],
    calendarStart: '2100-01-01',
    ...overrides,
  };
  const input: CalendarInput = {
    workouts: c.workouts,
    runs: c.runs,
    edits: c.edits,
    sessions: c.sessions,
    runLogs: c.runLogs,
    active: c.active,
    todayIso: c.todayIso,
  };
  const diet = { plan: c.plan, logs: c.log ? [c.log] : [], choices: c.choices, calendarStart: c.calendarStart };
  const days = buildCalendar(c.date, c.date, input);
  const info = dayInfo(c.date, days, input, diet);
  return buildHomeDay({ todayIso: c.todayIso, nowMinutes: c.nowMinutes, plan: c.plan, info, days, workouts: c.workouts, active: c.active });
}

const focus = (overrides: Partial<HomeCase>) => {
  const m = home(overrides).meal;
  return m.kind === 'meal' ? `${m.mode}:${m.meal.key}` : m.kind === 'finished' ? `finished:${m.eaten}/${m.total}` : m.kind;
};

const eatenLog = (eaten: Record<string, boolean>, date = TODAY): DietLogDay => ({
  date,
  planId: extendedPlan().id,
  mealsFrom: null,
  eaten,
  mealSources: {},
});

describe('pasto del momento (Home), orologio simulato', () => {
  it('orari limite delle finestre (lunedì: 07–09, 10–11, 12–13:30, 17:30–19, 20–21:30)', () => {
    expect(focus({ nowMinutes: at('06:59') })).toBe('next:colazione');
    expect(focus({ nowMinutes: at('07:00') })).toBe('now:colazione');
    expect(focus({ nowMinutes: at('08:59') })).toBe('now:colazione');
    // La fine della finestra è esclusa: alle 09:00 la colazione non è più "adesso".
    expect(focus({ nowMinutes: at('09:00') })).toBe('next:spuntino1');
    expect(focus({ nowMinutes: at('11:30') })).toBe('next:pranzo');
    expect(focus({ nowMinutes: at('13:00') })).toBe('now:pranzo');
    expect(focus({ nowMinutes: at('21:29') })).toBe('now:cena');
    expect(focus({ nowMinutes: at('21:31') })).toBe('finished:0/5');
  });

  it('pasto segnato: resta nella card (✓) finché è il pasto di quell’ora, poi tocca al prossimo', () => {
    const lunch = eatenLog({ pranzo: true });
    expect(focus({ log: lunch })).toBe('now:pranzo');
    const m = home({ log: lunch }).meal;
    expect(m.kind === 'meal' && m.meal.eaten).toBe(true);
    expect(focus({ log: lunch, nowMinutes: at('13:30') })).toBe('next:spuntino2');
    const all = { colazione: true, spuntino1: true, pranzo: true, spuntino2: true, cena: true };
    expect(focus({ log: eatenLog(all), nowMinutes: at('11:30') })).toBe('finished:5/5');
    expect(focus({ log: eatenLog(all), nowMinutes: at('10:30') })).toBe('now:spuntino1');
  });

  it('pasti vuoti, pasto libero senza alimenti, giorno senza piano, nessun piano', () => {
    const plan = partialPlan();
    // Lunedì: lo spuntino vuoto (MyDiet) non conta; la cena "Pasto libero" senza alimenti sì.
    expect(focus({ plan, nowMinutes: at('10:30') })).toBe('next:pranzo');
    expect(focus({ plan, nowMinutes: at('20:30') })).toBe('now:cena');
    const free = home({ plan, nowMinutes: at('20:30') }).meal;
    expect(free.kind === 'meal' && free.meal.items).toEqual([]);
    // Mercoledì 14: solo pasti vuoti. Sabato 17: non è nel piano.
    expect(focus({ plan, date: '2026-10-14', todayIso: '2026-10-14' })).toBe('no-meals');
    expect(focus({ plan, date: '2026-10-17', todayIso: '2026-10-17' })).toBe('not-in-plan');
    expect(focus({ plan: null })).toBe('no-plan');
  });

  it('altri giorni: il pasto della stessa ora, in sola lettura', () => {
    expect(focus({ date: '2026-10-13' })).toBe('preview:pranzo');
    expect(focus({ date: '2026-10-13', nowMinutes: at('23:00') })).toBe('preview:colazione');
    expect(focus({ date: '2026-10-11', todayIso: '2026-10-12' })).toBe('past:pranzo');
    expect(focus({ date: '2026-10-11', nowMinutes: at('23:00') })).toBe('past:cena');
    expect(home({ date: '2026-10-13' }).canTick).toBe(false);
    expect(home({ date: '2026-10-11' }).canTick).toBe(false);
    expect(home().canTick).toBe(true);
  });
});

describe('"oggi seguo il piano di un altro giorno" già salvato (2b, ora in sola lettura)', () => {
  const log = swapLogs()[0]!;

  it('oggi mostra e conteggia i pasti del giorno scelto', () => {
    const day = home({ log });
    expect(day.weekday).toBe(1);
    expect(day.view?.weekday).toBe(3);
    // Mercoledì: 4 pasti visibili (lo spuntino vuoto non si mostra).
    expect(day.view?.meals.map((m) => m.key)).toEqual(['colazione', 'spuntino1', 'pranzo', 'cena']);
    const wednesday = home({ date: '2026-10-14', todayIso: '2026-10-14' });
    expect(day.view?.meals[0]?.name).toBe(wednesday.view?.meals[0]?.name);
    // Conteggio: la colazione di mercoledì, segnata oggi.
    expect(day.calories?.shown.total.kcal).toBeCloseTo(day.view!.meals[0]!.totals.total.kcal);
    expect(day.timeline.find((t) => t.id === 'meal:colazione')?.state).toBe('done');
  });

  it('prima del calendario il tipo di giornata segue il piano scelto (riposo)', () => {
    const day = home({ log });
    expect(day.dayType).toMatchObject({ key: 'rest', label: 'Riposo', source: 'plan' });
    expect(day.typeNote).toBe('');
    expect(day.calories?.targets?.kcal).toBe(1550);
  });

  it('un diario di un altro piano non conta', () => {
    const other = swapLogs()[2]!;
    const day = home({ date: other.date, log: other });
    expect(day.view?.weekday).toBe(6);
    expect(day.calories?.shown.total.kcal).toBe(0);
    expect(day.timeline.filter((t) => t.state === 'done')).toEqual([]);
  });
});

describe('calorie e macro del giorno', () => {
  it('oggi: mangiate (dai pasti segnati) contro target, con l\'origine', () => {
    const empty = home();
    expect(empty.calories).toMatchObject({ mode: 'eaten', hasTargets: true, originText: 'Target del nutrizionista · giorno palestra' });
    expect(empty.calories?.shown.total.kcal).toBe(0);
    expect(empty.calories?.targets).toMatchObject({ kcal: 1800, protein: 140, carbs: 200, fat: 50 });
    const lunch = home({ log: eatenLog({ pranzo: true }) });
    expect(Math.round(lunch.calories!.shown.total.kcal)).toBe(567);
    expect(lunch.calories!.shown.total.protein).toBeGreaterThan(0);
  });

  it('ieri: le spunte di ieri; domani: le kcal del piano', () => {
    const yesterday = home({ date: '2026-10-11', log: swapLogs()[1] });
    expect(yesterday.calories?.mode).toBe('eaten');
    expect(yesterday.calories!.shown.total.kcal).toBeGreaterThan(0);
    const tomorrow = home({ date: '2026-10-13' });
    expect(tomorrow.calories?.mode).toBe('plan');
    expect(tomorrow.calories?.shown.total.kcal).toBe(tomorrow.view?.plan.total.kcal);
  });

  it('origine calcolata, senza tipo, senza piano', () => {
    const plan = partialPlan();
    expect(home({ plan, date: '2026-10-13' }).calories?.originText).toBe('Target calcolato dal piano · giorno riposo');
    expect(home({ plan, date: '2026-10-15' }).calories?.originText).toBe('Target calcolato dal piano');
    expect(home({ plan: null }).calories).toBeNull();
  });
});

describe('timeline della giornata', () => {
  const petto = () => ({ ...workoutNamed('Petto + Schiena'), time: '18:00' });
  const states = (day: ReturnType<typeof home>) => day.timeline.map((t) => `${t.id}=${t.state}@${t.time}`);

  it('lunedì alle 13:00, scheda alle 18:00: ordine per orario, stati, integratori', () => {
    const day = home({ workouts: [petto()] });
    expect(states(day)).toEqual([
      'meal:colazione=missed@07:30',
      'meal:spuntino1=missed@10:30',
      'meal:pranzo=now@13:00',
      'meal:spuntino2=next@18:00',
      `workout:workout:${petto().id}:2026-10-12=next@18:00`,
      'supp:0=next@18:00',
      'meal:cena=next@20:30',
      'supp:1=next@20:30',
      'supp:2=skipped@20:30',
    ]);
    expect(day.timeline.find((t) => t.kind === 'workout')?.label).toBe('Palestra · Petto + Schiena');
    expect(day.timeline.find((t) => t.id === 'supp:1')?.label).toBe('Vitamina D3 · 2.000 UI');
  });

  it('segnato il pranzo: fatto; ieri fatto / non segnato; domani tutto "dopo" (tranne i saltati)', () => {
    expect(home({ log: eatenLog({ pranzo: true }) }).timeline.find((t) => t.id === 'meal:pranzo')?.state).toBe('done');
    const yesterday = home({ date: '2026-10-11', log: swapLogs()[1] });
    expect(yesterday.timeline.map((t) => t.state)).toEqual(['done', 'done', 'missed', 'missed', 'missed']);
    const tomorrow = home({ date: '2026-10-13' });
    expect(new Set(tomorrow.timeline.map((t) => t.state))).toEqual(new Set(['next', 'skipped']));
  });

  it('senza orario: subito prima del post-workout, o dopo il pre-workout; altrimenti in fondo', () => {
    const noTime = home({ workouts: [workoutNamed('Petto + Schiena')] });
    const ids = noTime.timeline.map((t) => t.id);
    // Pranzo › allenamento › whey "dopo palestra" › post-workout.
    const workoutAt = ids.indexOf(`workout:workout:${workoutNamed('Petto + Schiena').id}:2026-10-12`);
    expect(ids.slice(workoutAt - 1, workoutAt + 3)).toEqual(['meal:pranzo', ids[workoutAt], 'supp:0', 'meal:spuntino2']);
    expect(noTime.timeline.find((t) => t.kind === 'workout')?.time).toBe('');

    const partial = home({ plan: partialPlan(), workouts: [workoutNamed('Petto + Schiena')] });
    expect(partial.timeline.map((t) => `${t.id}@${t.time}`)).toEqual([
      'meal:colazione@07:30',
      'meal:pranzo@13:00',
      'meal:pre@17:00',
      'supp:1@',
      `workout:workout:${workoutNamed('Petto + Schiena').id}:2026-10-12@`,
      'meal:cena@20:30',
      'supp:2@20:30',
      'supp:3@20:30',
      'supp:0@mattina',
    ]);

    // Martedì del piano esteso: nessun pre/post-workout alla voce "Gambe" → in fondo, senza orario.
    const tuesday = home({ date: '2026-10-13', todayIso: '2026-10-13', workouts: [workoutNamed('Gambe')], plan: partialPlan() });
    expect(tuesday.timeline.at(-1)?.kind).toBe('workout');
  });

  it('allenamento in corso, fatto, orario passato, fuori programma', () => {
    const w = petto();
    const live = sessionOf(w, 's-live', new Date(2026, 9, 12, 18, 5), null);
    expect(home({ workouts: [w], nowMinutes: at('18:30'), active: live }).timeline.find((t) => t.kind === 'workout')).toMatchObject({
      state: 'now',
      time: '18:05',
    });
    const done = sessionOf(w, 's-done', new Date(2026, 9, 12, 18, 5), new Date(2026, 9, 12, 19, 10));
    const after = home({ workouts: [w], nowMinutes: at('20:00'), sessions: [done] });
    expect(after.workouts[0]).toMatchObject({ status: 'done', timeLabel: '18:05' });
    expect(workoutWhen(after.workouts[0]!, 'today', at('20:00'))).toBe('fatto alle 19:10');
    expect(after.timeline.find((t) => t.kind === 'workout')?.state).toBe('done');
    expect(after.timeline.find((t) => t.id === 'supp:0')?.state).toBe('done');

    const late = home({ workouts: [w], nowMinutes: at('21:00') });
    expect(late.timeline.find((t) => t.kind === 'workout')?.state).toBe('missed');
    const during = home({ workouts: [w], nowMinutes: at('18:10') });
    expect(during.timeline.find((t) => t.kind === 'workout')?.state).toBe('now');

    const braccia = workoutNamed('Braccia');
    const extra = sessionOf(braccia, 's-extra', new Date(2026, 9, 12, 9, 0), new Date(2026, 9, 12, 10, 0));
    const withExtra = home({ workouts: [w, braccia], sessions: [extra] });
    expect(withExtra.workouts.map((e) => [e.name, e.scheduled, e.status])).toEqual([
      ['Petto + Schiena', true, 'todo'],
      ['Braccia', false, 'done'],
    ]);
    // Iniziata alle 9:00: dopo la colazione (finestra dalle 7:00), prima dello spuntino (dalle 10:00).
    expect(withExtra.timeline[1]?.label).toBe('Palestra · Braccia');
  });

  it('giorni passati: allenamento non fatto; più schede nello stesso giorno', () => {
    const tuesday = home({ date: '2026-10-13', todayIso: '2026-10-14' });
    expect(tuesday.workouts.map((e) => e.name)).toEqual(['Gambe']);
    expect(workoutWhen(tuesday.workouts[0]!, 'past', at('13:00'))).toBe('non fatto');
    expect(tuesday.timeline.find((t) => t.kind === 'workout')?.state).toBe('missed');
    const two = home({ workouts: [petto(), { ...workoutNamed('Gambe'), weekdays: [1] }] });
    expect(two.workouts.map((e) => e.name)).toEqual(['Gambe', 'Petto + Schiena']);
    expect(two.timeline.filter((t) => t.kind === 'workout')).toHaveLength(2);
  });

  it('testi della card allenamento', () => {
    const w = petto();
    const entry = home({ workouts: [w] }).workouts[0]!;
    expect(entry.timeLabel).toMatch(/^18:00–\d{2}:\d{2}$/);
    expect(entry.durationMin).toBe(workoutTotals(w).totalMin);
    expect(workoutWhen(entry, 'today', at('12:40'))).toBe('tra 5 h 20 min');
    expect(workoutWhen(entry, 'today', at('18:01'))).toBe('adesso');
    expect(workoutWhen(entry, 'future', at('12:40'))).toBe('in programma');
    expect(inTimeLabel(40)).toBe('tra 40 min');
    expect(inTimeLabel(120)).toBe('tra 2 h');
  });
});

describe('tip del giorno', () => {
  const day = home();

  it('stessa data = stesso tip; date diverse danno tip diversi', () => {
    const ctx = { dayTypeKey: 'gym', hasPlan: true };
    expect(dailyTip(TODAY, day.view!.observations, ctx)).toEqual(dailyTip(TODAY, day.view!.observations, ctx));
    const texts = new Set(
      Array.from({ length: 30 }, (_, i) => dailyTip(`2026-11-${String(i + 1).padStart(2, '0')}`, [], ctx).text),
    );
    expect(texts.size).toBeGreaterThan(3);
  });

  it('tra le scelte ci sono le osservazioni di quel giorno, con l\'avvertenza', () => {
    const obs = day.view!.observations;
    expect(obs.map((o) => o.kind)).toEqual(['deviation']);
    const picks = Array.from({ length: 60 }, (_, i) => dailyTip(`2027-01-${i}`, obs, { dayTypeKey: 'gym', hasPlan: true }));
    const observation = picks.find((t) => t.source === 'observation');
    expect(observation?.text).toBe(obs[0]!.text);
    expect(observation?.disclaimer).toBe("L'app non modifica il piano: segnala soltanto.");
    expect(picks.filter((t) => t.source === 'generic').every((t) => t.disclaimer === '')).toBe(true);
  });

  it('con un piano niente consigli su cosa mangiare; filtrati per tipo di giornata', () => {
    const withPlan = genericTipsFor({ dayTypeKey: 'rest', hasPlan: true });
    expect(withPlan.some((t) => t.noPlanOnly)).toBe(false);
    expect(withPlan.every((t) => t.tags.includes('any') || t.tags.includes('rest'))).toBe(true);
    expect(genericTipsFor({ dayTypeKey: 'gym', hasPlan: false }).some((t) => t.noPlanOnly)).toBe(true);
    // Nessun tip parla di aumentare o ridurre quantità: con un piano si seguono le porzioni.
    expect(GENERIC_TIPS.filter((t) => !t.noPlanOnly).some((t) => /aument|riduc|di più di|grammi|\bg\b/i.test(t.text))).toBe(false);
  });
});

describe('indicatore SYNC OFFLINE', () => {
  const ok: SyncInputs = { dbOk: true, standalone: true, swControlled: true, persisted: true };

  it('il ✓ solo con tutte e quattro le condizioni', () => {
    expect(syncStatus(ok)).toMatchObject({ kind: 'ok', label: 'SYNC OFFLINE ✓', tone: 'progress' });
    expect(isSyncOk(ok)).toBe(true);
    for (const key of ['dbOk', 'standalone', 'swControlled', 'persisted'] as const) {
      expect(isSyncOk({ ...ok, [key]: false })).toBe(false);
      expect(syncStatus({ ...ok, [key]: false }).label).not.toContain('✓');
    }
    expect(isSyncOk({ ...ok, persisted: null })).toBe(false);
    expect(isSyncOk({ ...ok, dbOk: null })).toBe(false);
  });

  it('negli altri casi un\'etichetta, in ordine di gravità', () => {
    expect(syncStatus({ ...ok, dbOk: false, standalone: false }).label).toBe('NON SALVATO');
    expect(syncStatus({ ...ok, dbOk: null }).label).toBe('VERIFICO…');
    expect(syncStatus({ ...ok, standalone: false, swControlled: false }).label).toBe('SOLO BROWSER');
    expect(syncStatus({ ...ok, swControlled: false, persisted: false }).label).toBe('OFFLINE NON PRONTO');
    expect(syncStatus({ ...ok, persisted: false })).toMatchObject({ label: 'NON PROTETTO', tone: 'tip' });
    expect(syncStatus({ ...ok, persisted: null }).label).toBe('NON PROTETTO');
  });

  it('etichette corte: stanno sulla riga della data', () => {
    const all = [
      ok,
      { ...ok, dbOk: false },
      { ...ok, dbOk: null },
      { ...ok, standalone: false },
      { ...ok, swControlled: false },
      { ...ok, persisted: false },
    ];
    for (const input of all) expect(syncStatus(input).label.length).toBeLessThanOrEqual(18);
  });
});

/** Striscia della settimana di oggi, con il tipo del piano (prima del calendario). */
function stripOf(plan: DietPlan | null, logs: DietLogDay[]) {
  const input: CalendarInput = { workouts: weekWorkouts(), runs: [], edits: [], sessions: [], runLogs: [], active: null, todayIso: TODAY };
  const { infos } = dayInfos('2026-10-12', '2026-10-18', input, { plan, logs, choices: [], calendarStart: '2100-01-01' });
  return homeStrip(infos, TODAY);
}

describe('giorni e mezzanotte', () => {
  it('relazione con oggi e parola relativa', () => {
    expect(relationOf('2026-10-12', TODAY)).toBe('today');
    expect(relationOf('2026-10-11', TODAY)).toBe('past');
    expect(relationOf('2026-10-13', TODAY)).toBe('future');
    expect(relativeDayWord('2026-10-11', TODAY)).toBe('Ieri');
    expect(relativeDayWord('2026-10-13', TODAY)).toBe('Domani');
    expect(relativeDayWord('2026-10-16', TODAY)).toBe('Tra 4 giorni');
    expect(relativeDayWord('2026-10-12', '2026-10-15')).toBe('3 giorni fa');
    expect(relativeDayWord(TODAY, TODAY)).toBe('');
  });

  it('a mezzanotte "oggi" passa al giorno dopo: il giorno prima diventa passato e in sola lettura', () => {
    const before = home({ nowMinutes: at('23:59') });
    expect(before.relation).toBe('today');
    const after = home({ todayIso: '2026-10-13', nowMinutes: 0 });
    expect(after.relation).toBe('past');
    expect(after.canTick).toBe(false);
    expect(home({ date: '2026-10-13', todayIso: '2026-10-13', nowMinutes: 0 }).relation).toBe('today');
  });

  it('settimana L–D e striscia con il tipo di ogni giorno (scambio compreso, prima del calendario)', () => {
    expect(weekDates('2026-10-14')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(weekDates('2026-10-18')[0]).toBe('2026-10-12');
    const strip = stripOf(extendedPlan(), swapLogs());
    expect(strip.map((d) => `${d.initial}${d.dayNumber}:${d.tone}`)).toEqual([
      'L12:muted', // lunedì segue mercoledì (riposo)
      'M13:training',
      'M14:muted',
      'G15:training',
      'V16:training',
      'S17:progress',
      'D18:muted',
    ]);
    expect(strip.filter((d) => d.isToday).map((d) => d.date)).toEqual([TODAY]);
    expect(stripOf(null, []).map((d) => d.tone)).toEqual([
      'training',
      'training',
      'training',
      'muted',
      'muted',
      'training',
      'muted',
    ]);
  });
});
