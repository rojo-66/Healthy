import type { CalendarInput } from '../../../src/lib/calendar/occurrences';
import { occurrenceKey, type CalendarEdit } from '../../../src/lib/data/schemas/calendar';
import type { Run, RunLog } from '../../../src/lib/data/schemas/runs';
import type { Session } from '../../../src/lib/data/schemas/sessions';
import type { Workout } from '../../../src/lib/data/schemas/workouts';
import { weekWorkouts } from '../workouts/helpers';

/**
 * Settimana finta del calendario (2c). Oggi = lunedì 12 ottobre 2026.
 * Petto lun · Gambe mer · Corsa gio · Spalle ven. Finestra: lun 5 → dom 25 ottobre.
 */
export const TODAY = '2026-10-12';

export function workout(id: string, name: string, weekdays: number[]): Workout {
  const base = weekWorkouts()[0]!;
  return { ...base, id, name, weekdays };
}

export function run(id: string, name: string, weekdays: number[]): Run {
  return {
    id,
    name,
    weekdays,
    time: null,
    targetMinutes: 30,
    targetKm: null,
    note: '',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
  };
}

export const PETTO = workout('petto', 'Petto', [1]);
export const GAMBE = workout('gambe', 'Gambe', [3]);
export const SPALLE = workout('spalle', 'Spalle', [5]);
export const CORSA = run('corsa', 'Corsa lenta', [4]);

/** Sessione conclusa alle 18 di quel giorno (ora locale). */
export function session(workoutId: string, date: string, id = `s-${workoutId}-${date}`, ended = true): Session {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y!, m! - 1, d!, 18, 0);
  return {
    id,
    workoutId,
    workoutVersion: 1,
    workoutName: workoutId,
    startedAt: start.toISOString(),
    endedAt: ended ? new Date(start.getTime() + 3600_000).toISOString() : null,
    readiness: null,
    sets: [],
    userNotes: [],
    rpe: null,
    cardio: [],
    snapshot: null,
    live: null,
  } as Session;
}

export function runLog(runId: string | null, date: string, id = `l-${runId}-${date}`): RunLog {
  return {
    id,
    runId,
    runName: 'Corsa lenta',
    date,
    loggedAt: `${date}T07:00:00.000Z`,
    durationSec: 1800,
    distanceKm: 5,
    rpe: null,
    note: '',
  };
}

export function move(kind: 'workout' | 'run', refId: string, originalDate: string, toDate: string): CalendarEdit {
  return { key: occurrenceKey(kind, refId, originalDate), kind, refId, originalDate, action: 'move', toDate, createdAt: '2026-10-12T08:00:00.000Z' };
}

export function skip(kind: 'workout' | 'run', refId: string, originalDate: string, toDate: string | null = null): CalendarEdit {
  return { key: occurrenceKey(kind, refId, originalDate), kind, refId, originalDate, action: 'skip', toDate, createdAt: '2026-10-12T08:00:00.000Z' };
}

export function input(patch: Partial<CalendarInput> = {}): CalendarInput {
  return {
    workouts: [PETTO, GAMBE, SPALLE],
    runs: [CORSA],
    edits: [],
    sessions: [],
    runLogs: [],
    active: null,
    todayIso: TODAY,
    ...patch,
  };
}

export const key = (kind: 'workout' | 'run', refId: string, date: string) => occurrenceKey(kind, refId, date);
