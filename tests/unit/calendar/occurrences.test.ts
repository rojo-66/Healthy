import { describe, expect, it } from 'vitest';
import { buildCalendar, calendarWindow, canReschedule, dayActivities, occurrencesOn } from '../../../src/lib/calendar/occurrences';
import { weekPlan } from '../../../src/lib/workouts/calc/week';
import { CORSA, GAMBE, input, key, move, PETTO, runLog, session, skip, SPALLE, TODAY, workout } from './helpers';

/** Occorrenze (2c): ricorrenza settimanale + eccezioni, collegamento con sessioni e corse fatte. */

const WINDOW = calendarWindow(TODAY);
const all = (patch = {}) => buildCalendar(WINDOW.from, WINDOW.to, input(patch));

describe('finestra', () => {
  it('settimana scorsa, questa e prossima', () => {
    expect(WINDOW).toEqual({ from: '2026-10-05', to: '2026-10-25', weeks: ['2026-10-05', '2026-10-12', '2026-10-19'] });
    expect(calendarWindow('2026-10-18').from).toBe('2026-10-05');
  });
});

describe('ricorrenza senza eccezioni', () => {
  it('ogni attività nei suoi giorni, con gli stati', () => {
    const { occurrences } = all();
    expect(occurrences).toHaveLength(12);
    expect(occurrencesOn(occurrences, '2026-10-12').map((o) => o.key)).toEqual([key('workout', 'petto', '2026-10-12')]);
    expect(occurrencesOn(occurrences, '2026-10-15').map((o) => [o.name, o.kind])).toEqual([['Corsa lenta', 'run']]);
    // Passate e non fatte = missed; da oggi = todo.
    expect(occurrencesOn(occurrences, '2026-10-07')[0]!.status).toBe('missed');
    expect(occurrencesOn(occurrences, '2026-10-12')[0]!.status).toBe('todo');
    expect(occurrences.every((o) => !o.moved && !o.skipped)).toBe(true);
  });
});

describe('eccezioni', () => {
  it('spostata: il giorno originale resta vuoto, quello nuovo ce l’ha', () => {
    const { occurrences } = all({ edits: [move('workout', 'petto', '2026-10-12', '2026-10-13')] });
    expect(occurrencesOn(occurrences, '2026-10-12')).toEqual([]);
    expect(occurrencesOn(occurrences, '2026-10-13')[0]).toMatchObject({ name: 'Petto', moved: true, originalDate: '2026-10-12', status: 'todo' });
  });

  it('oltre la settimana: venerdì → lunedì dopo, si vede solo nella settimana dove arriva', () => {
    const edits = [move('workout', 'spalle', '2026-10-16', '2026-10-19')];
    const thisWeek = buildCalendar('2026-10-12', '2026-10-18', input({ edits }));
    expect(thisWeek.occurrences.some((o) => o.refId === 'spalle')).toBe(false);
    const nextWeek = buildCalendar('2026-10-19', '2026-10-25', input({ edits }));
    const spalle = nextWeek.occurrences.filter((o) => o.refId === 'spalle');
    expect(spalle.map((o) => [o.originalDate, o.date])).toEqual([
      ['2026-10-16', '2026-10-19'],
      ['2026-10-23', '2026-10-23'],
    ]);
  });

  it('saltata: resta nel suo giorno con lo stato "saltata" (anche se era stata spostata)', () => {
    const { occurrences } = all({ edits: [skip('run', 'corsa', '2026-10-15'), skip('workout', 'gambe', '2026-10-14', '2026-10-17')] });
    expect(occurrencesOn(occurrences, '2026-10-15')[0]).toMatchObject({ status: 'skipped', skipped: true });
    expect(occurrencesOn(occurrences, '2026-10-17')[0]).toMatchObject({ name: 'Gambe', status: 'skipped', moved: true });
    expect(occurrencesOn(occurrences, '2026-10-14')).toEqual([]);
  });

  it('eccezioni orfane (scheda eliminata, giorni cambiati nell’Editor) ignorate', () => {
    const edits = [move('workout', 'eliminata', '2026-10-12', '2026-10-13'), move('workout', 'petto', '2026-10-13', '2026-10-14')];
    const { occurrences } = all({ edits });
    expect(occurrences.some((o) => o.moved)).toBe(false);
    expect(occurrencesOn(occurrences, '2026-10-12')[0]!.name).toBe('Petto');
  });
});

describe('collegamento con quello che è stato fatto', () => {
  it('la sessione completa l’occorrenza della stessa scheda nel giorno effettivo (anche spostata)', () => {
    const edits = [move('workout', 'petto', '2026-10-12', '2026-10-13')];
    const days = buildCalendar(WINDOW.from, WINDOW.to, input({ edits, sessions: [session('petto', '2026-10-13')], todayIso: '2026-10-14' }));
    expect(occurrencesOn(days.occurrences, '2026-10-13')[0]).toMatchObject({ status: 'done', moved: true });
    expect(days.extraSessions).toEqual([]);
  });

  it('fatta in un altro giorno senza spostarla: fuori programma, l’occorrenza resta da fare', () => {
    const days = buildCalendar(WINDOW.from, WINDOW.to, input({ sessions: [session('gambe', '2026-10-13')], todayIso: '2026-10-13' }));
    expect(occurrencesOn(days.occurrences, '2026-10-14')[0]!.status).toBe('todo');
    expect(days.extraSessions.map((s) => s.id)).toEqual(['s-gambe-2026-10-13']);
    expect(dayActivities(days, '2026-10-13')).toEqual({ gym: true, run: false });
  });

  it('corse: fatta nel suo giorno = completata; senza corsa pianificata = fuori programma', () => {
    const days = all({ runLogs: [runLog('corsa', '2026-10-08'), runLog(null, '2026-10-09')] });
    expect(occurrencesOn(days.occurrences, '2026-10-08')[0]!.status).toBe('done');
    expect(days.extraLogs.map((l) => l.date)).toEqual(['2026-10-09']);
  });

  it('sessione in corso: occorrenza "in corso"; fatte e in corso non si spostano', () => {
    const active = session('petto', TODAY, 'live', false);
    const days = all({ active, sessions: [active] });
    const petto = occurrencesOn(days.occurrences, TODAY)[0]!;
    expect(petto.status).toBe('in-progress');
    expect(canReschedule(petto, WINDOW)).toBe(false);
    const missed = occurrencesOn(days.occurrences, '2026-10-05')[0]!;
    expect(canReschedule(missed, WINDOW)).toBe(true);
  });

  it('attività del giorno: saltate escluse', () => {
    const days = all({ edits: [skip('workout', 'petto', TODAY)] });
    expect(dayActivities(days, TODAY)).toEqual({ gym: false, run: false });
  });
});

describe('settimana di Allena dalle occorrenze', () => {
  it('spostamenti, salti, "prossimo" che segue lo spostamento, giorni fatti in parte', () => {
    const edits = [move('workout', 'petto', '2026-10-12', '2026-10-15'), skip('workout', 'spalle', '2026-10-16')];
    const plan = weekPlan(input({ edits }));
    expect(plan.days.map((d) => d.state)).toEqual(['rest', 'rest', 'next', 'todo', 'skipped', 'rest', 'rest']);
    expect(plan.days[3]).toMatchObject({ tag: 'PET', tagKind: 'workout', movedIn: true });
    expect(plan.next).toMatchObject({ date: '2026-10-14', inDays: 2 });
    expect(plan.next!.workout.id).toBe(GAMBE.id);

    const partial = weekPlan(input({ edits, sessions: [session('petto', '2026-10-15')], todayIso: '2026-10-16' }));
    expect(partial.days[3]!.state).toBe('partial');
  });

  it('nessuna scheda: niente prossimo', () => {
    expect(weekPlan(input({ workouts: [], runs: [CORSA] })).next).toBeNull();
    expect(weekPlan(input({ workouts: [workout('x', 'X', [])], runs: [] })).days.every((d) => d.state === 'rest')).toBe(true);
    void PETTO;
    void SPALLE;
  });
});
