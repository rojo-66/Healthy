import { describe, expect, it } from 'vitest';
import { weekPlan, workoutTag } from '../../../src/lib/workouts/calc/week';
import { relativeDay } from '../../../src/lib/workouts/format';
import type { CalendarInput } from '../../../src/lib/calendar/occurrences';
import type { Session } from '../../../src/lib/data/schemas/sessions';
import type { Workout } from '../../../src/lib/data/schemas/workouts';
import { toIsoDate } from '../../../src/lib/diet/calc/calendar';
import { MONDAY, onDay, weekWorkouts } from './helpers';

/** Settimana di Allena come prima del 2c, ma dalle occorrenze (nessuna eccezione). */
function week(workouts: Workout[], sessions: Partial<Session>[], today: Date) {
  const input: CalendarInput = {
    workouts,
    runs: [],
    edits: [],
    sessions: sessions as Session[],
    runLogs: [],
    active: null,
    todayIso: toIsoDate(today),
  };
  return weekPlan(input);
}

const done = (workoutId: string, at: Date) => ({ workoutId, startedAt: at.toISOString(), endedAt: new Date(at.getTime() + 3600_000).toISOString() });

// Fixture: Petto + Schiena lun · Gambe mar · Àddome e mobilità mer e sab · Braccia nessun giorno.
const PETTO = 'b1111111-1111-4111-8111-111111111111';
const GAMBE = 'b2222222-2222-4222-8222-222222222222';

describe('sigla', () => {
  it('prime 3 lettere, senza accenti né simboli, in maiuscolo', () => {
    expect(workoutTag('Petto + Schiena')).toBe('PET');
    expect(workoutTag('Àddome e mobilità')).toBe('ADD');
    expect(workoutTag('5x5 forza')).toBe('5X5');
    expect(workoutTag('A B')).toBe('AB');
    expect(workoutTag('+++')).toBe('—');
  });
});

describe('settimana e prossimo allenamento', () => {
  it('senza sessioni: oggi è il prossimo, poi in programma o riposo', () => {
    const { days, next } = week(weekWorkouts(), [], MONDAY);
    expect(days.map((d) => d.tag)).toEqual(['PET', 'GAM', 'ADD', '—', '—', 'ADD', '—']);
    expect(days.map((d) => d.state)).toEqual(['next', 'todo', 'todo', 'rest', 'rest', 'todo', 'rest']);
    expect(days[0]).toMatchObject({ date: '2026-10-12', isToday: true });
    expect(days[6]!.date).toBe('2026-10-18');
    expect(next).toMatchObject({ date: '2026-10-12', weekday: 1, inDays: 0 });
    expect(next?.workout.name).toBe('Petto + Schiena');
  });

  it('fatto oggi → prossimo domani', () => {
    const { days, next } = week(weekWorkouts(), [done(PETTO, MONDAY)], MONDAY);
    expect(days[0]!.state).toBe('done');
    expect(days[1]!.state).toBe('next');
    expect(next).toMatchObject({ weekday: 2, inDays: 1 });
    expect(relativeDay(next!.inDays)).toBe('domani');
  });

  it('giorni passati senza sessione = NON FATTO (missed)', () => {
    const thursday = onDay(MONDAY, 3);
    const { days, next } = week(weekWorkouts(), [done(GAMBE, onDay(MONDAY, 1))], thursday);
    expect(days.map((d) => d.state)).toEqual(['missed', 'done', 'missed', 'rest', 'rest', 'next', 'rest']);
    expect(next).toMatchObject({ weekday: 6, inDays: 2 });
  });

  it('una sessione non conclusa non conta come fatta', () => {
    const open = { workoutId: PETTO, startedAt: MONDAY.toISOString(), endedAt: null };
    expect(week(weekWorkouts(), [open], MONDAY).days[0]!.state).toBe('next');
  });

  it('settimana finita → primo giorno con scheda della settimana dopo', () => {
    const sunday = onDay(MONDAY, 6);
    const { next } = week(weekWorkouts(), [], sunday);
    expect(next).toMatchObject({ date: '2026-10-19', weekday: 1, inDays: 1 });
  });

  it('più schede nello stesso giorno: sigla della prima per nome, tutte nel dettaglio', () => {
    const workouts = weekWorkouts();
    workouts.find((w) => w.name === 'Braccia')!.weekdays = [1];
    const day = week(workouts, [], MONDAY).days[0]!;
    expect(day.workouts.map((w) => w.name)).toEqual(['Braccia', 'Petto + Schiena']);
    expect(day.tag).toBe('BRA');
  });

  it('nessuna scheda con giorni → nessun prossimo, tutto riposo', () => {
    const workouts = weekWorkouts().map((w) => ({ ...w, weekdays: [] }));
    const plan = week(workouts, [], MONDAY);
    expect(plan.next).toBeNull();
    expect(plan.days.every((d) => d.state === 'rest')).toBe(true);
    expect(week([], [], MONDAY).next).toBeNull();
  });
});
