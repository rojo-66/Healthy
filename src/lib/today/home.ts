import { dietView, type DayInfo } from '../calendar/days';
import type { CalendarDays } from '../calendar/occurrences';
import type { DietLogDay } from '../data/schemas/diet-log';
import type { DietPlan } from '../data/schemas/diet-plans';
import type { Session } from '../data/schemas/sessions';
import type { Workout } from '../data/schemas/workouts';
import { addDays, fromIsoDate, weekStartOf, WEEKDAY_INITIALS } from '../diet/calc/calendar';
import type { Totals } from '../diet/calc/nutrients';
import { TARGET_ORIGIN_TEXT, type DayTargets } from '../diet/calc/targets';
import type { DayTypeTone, DayView } from '../diet/view';
import { sessionDate } from '../sessions/calendar';
import { missingTypeText, type ResolvedDayType } from './day-type';
import { focusMeal, type DayRelation, type MealFocus } from './meal-focus';
import { buildTimeline, type TimelineItem } from './timeline';
import { dailyTip, type Tip } from './tips';
import { runsForDay, workoutsForDay, type RunEntry, type WorkoutEntry } from './workout-day';

export { logFor } from '../calendar/days';

/**
 * Tutto ciò che la Home mostra per un giorno, calcolato qui (funzioni pure, testate):
 * i componenti si limitano a disegnare.
 */

export interface HomeInput {
  todayIso: string;
  nowMinutes: number;
  /** Piano alimentare attivo. */
  plan: DietPlan | null;
  /** Il giorno mostrato con tipo di giornata, diario e attività (`calendar/days.ts`). */
  info: DayInfo;
  /** Calendario del periodo (per le attività fuori programma). */
  days: CalendarDays;
  workouts: readonly Workout[];
  /** Sessione in corso, se c'è (conta solo per oggi). */
  active: Session | null;
}

export interface HomeCalories {
  shown: Totals;
  targets: DayTargets | null;
  /** Oggi e giorni passati: kcal mangiate; domani: kcal del piano. */
  mode: 'eaten' | 'plan';
  /** "Target del nutrizionista · giorno palestra", "Target mancante". */
  originText: string;
  hasTargets: boolean;
}

export interface HomeDay {
  date: string;
  weekday: number;
  relation: DayRelation;
  hasPlan: boolean;
  view: DayView | null;
  eaten: Readonly<Record<string, boolean>>;
  dayType: ResolvedDayType;
  /** Riga gialla: il piano non ha il tipo di giornata delle attività ("" se non serve). */
  typeNote: string;
  calories: HomeCalories | null;
  meal: MealFocus;
  /** Il pasto si segna solo oggi (come nella Dieta). */
  canTick: boolean;
  workouts: WorkoutEntry[];
  /** Corse del giorno (2a). */
  runs: RunEntry[];
  timeline: TimelineItem[];
  tip: Tip;
}

export function relationOf(date: string, todayIso: string): DayRelation {
  if (date === todayIso) return 'today';
  return date < todayIso ? 'past' : 'future';
}

export function buildHomeDay(input: HomeInput): HomeDay {
  const { todayIso, nowMinutes, plan, info, days } = input;
  const date = info.date;
  const relation = relationOf(date, todayIso);
  const log: DietLogDay | undefined = info.log;
  const eaten = relation === 'future' ? {} : (log?.eaten ?? {});
  const view = dietView(info, plan, { today: relation === 'today', keepEaten: relation === 'past', nowMinutes });
  const dayType = info.type;

  let calories: HomeCalories | null = null;
  if (view) {
    const origin = view.resolved ? TARGET_ORIGIN_TEXT[view.resolved.origin] : 'Target mancante';
    calories = {
      shown: relation === 'future' ? view.plan : view.eatenTotals,
      targets: view.resolved?.targets ?? null,
      mode: relation === 'future' ? 'plan' : 'eaten',
      originText: view.resolved && view.typeKey !== null ? `${origin} · giorno ${view.typeLabel.toLowerCase()}` : origin,
      hasTargets: view.resolved !== null,
    };
  }

  const active = relation === 'today' ? input.active : null;
  const workouts = workoutsForDay(
    info.occurrences,
    days.extraSessions.filter((s) => sessionDate(s) === date),
    active,
    input.workouts,
  );
  const runs = runsForDay(
    info.occurrences,
    days.extraLogs.filter((l) => l.date === date),
  );

  return {
    date,
    weekday: info.weekday,
    relation,
    hasPlan: plan !== null,
    view,
    eaten,
    dayType,
    typeNote: missingTypeText(dayType),
    calories,
    meal: focusMeal(plan !== null, view, eaten, nowMinutes, relation),
    canTick: relation === 'today' && view !== null,
    workouts,
    runs,
    timeline: buildTimeline({ view, workouts, runs, relation, nowMinutes, eaten }),
    tip: dailyTip(date, view?.observations ?? [], { dayTypeKey: dayType.key, hasPlan: plan !== null }),
  };
}

// --- Striscia dei giorni (3 settimane, 2c) ---

export interface HomeStripDay {
  date: string;
  weekday: number;
  initial: string;
  dayNumber: number;
  tone: DayTypeTone;
  typeLabel: string;
  isToday: boolean;
}

/** Le 7 date (lunedì–domenica) della settimana di una data. */
export function weekDates(iso: string): string[] {
  const start = weekStartOf(fromIsoDate(iso));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
}

/** Striscia: tipo di giornata di ogni giorno (dalle attività, con la scelta della dieta). */
export function homeStrip(infos: readonly DayInfo[], todayIso: string): HomeStripDay[] {
  return infos.map((info) => ({
    date: info.date,
    weekday: info.weekday,
    initial: WEEKDAY_INITIALS[info.weekday - 1] ?? '',
    dayNumber: fromIsoDate(info.date).getDate(),
    tone: info.type.tone,
    typeLabel: info.type.label,
    isToday: info.date === todayIso,
  }));
}

/** "Ieri", "Domani", "Tra 3 giorni", "4 giorni fa" (oggi: ""). */
export function relativeDayWord(date: string, todayIso: string): string {
  const diff = Math.round((fromIsoDate(date).getTime() - fromIsoDate(todayIso).getTime()) / 86_400_000);
  if (diff === 0) return '';
  if (diff === -1) return 'Ieri';
  if (diff === 1) return 'Domani';
  return diff > 0 ? `Tra ${diff} giorni` : `${-diff} giorni fa`;
}
