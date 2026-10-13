import { liveState } from '../data/live.svelte';
import { getCalendarStart, listCalendarEdits, listDayChoices } from '../data/repo/calendar';
import { dietLogBetween } from '../data/repo/diet-log';
import { listDietPlans } from '../data/repo/diet-plans';
import { listRunLogs, listRuns } from '../data/repo/runs';
import { activeSession, sessionsBetween } from '../data/repo/sessions';
import { listWorkoutsRecent } from '../data/repo/workouts';
import type { CalendarEdit, DayChoice } from '../data/schemas/calendar';
import type { DietLogDay } from '../data/schemas/diet-log';
import type { DietPlan } from '../data/schemas/diet-plans';
import type { Run, RunLog } from '../data/schemas/runs';
import type { Session } from '../data/schemas/sessions';
import type { Workout } from '../data/schemas/workouts';
import { addDays, fromIsoDate } from '../diet/calc/calendar';
import type { DietContext } from './days';
import type { CalendarInput } from './occurrences';

/**
 * Tutti i dati del calendario (2c), dal database locale, aggiornati da soli: schede, corse, eccezioni, diete scelte,
 * sessioni e diario del periodo, piano attivo. Va creato durante l'inizializzazione di un componente (come `liveState`).
 */
export interface LiveCalendar {
  readonly loaded: boolean;
  readonly workouts: Workout[];
  readonly runs: Run[];
  readonly plans: DietPlan[];
  readonly plan: DietPlan | null;
  readonly active: Session | null;
  input(todayIso: string): CalendarInput;
  readonly diet: DietContext;
}

/** `from`–`to` (date comprese): periodo di sessioni e diario da leggere. */
export function liveCalendar(from: string, to: string): LiveCalendar {
  const workouts = liveState<Workout[]>(listWorkoutsRecent, []);
  const runs = liveState<Run[]>(listRuns, []);
  const edits = liveState<CalendarEdit[]>(listCalendarEdits, []);
  const choices = liveState<DayChoice[]>(listDayChoices, []);
  const start = liveState<string | null>(getCalendarStart, null);
  const sessions = liveState<Session[]>(
    () => sessionsBetween(fromIsoDate(from).toISOString(), fromIsoDate(addDays(to, 1)).toISOString()),
    [],
  );
  const runLogs = liveState<RunLog[]>(listRunLogs, []);
  const active = liveState<Session | null>(activeSession, null);
  const plans = liveState<DietPlan[]>(listDietPlans, []);
  const logs = liveState<DietLogDay[]>(() => dietLogBetween(from, to), []);
  const all = [workouts, runs, edits, choices, start, sessions, runLogs, active, plans, logs];

  const loaded = $derived(all.every((s) => s.loaded));
  const plan = $derived(plans.current.find((p) => p.active) ?? null);
  const diet = $derived<DietContext>({ plan, logs: logs.current, choices: choices.current, calendarStart: start.current });

  return {
    get loaded() {
      return loaded;
    },
    get workouts() {
      return workouts.current;
    },
    get runs() {
      return runs.current;
    },
    get plans() {
      return plans.current;
    },
    get plan() {
      return plan;
    },
    get active() {
      return active.current;
    },
    input: (todayIso) => ({
      workouts: workouts.current,
      runs: runs.current,
      edits: edits.current,
      sessions: sessions.current,
      runLogs: runLogs.current,
      active: active.current,
      todayIso,
    }),
    get diet() {
      return diet;
    },
  };
}
