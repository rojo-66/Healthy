import type { DietLogDay } from '../data/schemas/diet-log';
import type { DietPlan } from '../data/schemas/diet-plans';
import type { Session } from '../data/schemas/sessions';
import type { Workout } from '../data/schemas/workouts';
import { addDays, effectiveWeekday, fromIsoDate, isoWeekday, weekStartOf, WEEKDAY_INITIALS } from '../diet/calc/calendar';
import type { Totals } from '../diet/calc/nutrients';
import { TARGET_ORIGIN_TEXT, type DayTargets } from '../diet/calc/targets';
import { buildDayView, findDay, type DayTypeTone, type DayView } from '../diet/view';
import { workoutsOn } from '../workouts/calc/week';
import { conflictText, resolveDayType, type ResolvedDayType } from './day-type';
import { focusMeal, type DayRelation, type MealFocus } from './meal-focus';
import { buildTimeline, type TimelineItem } from './timeline';
import { dailyTip, type Tip } from './tips';
import { workoutsForDay, type WorkoutEntry } from './workout-day';

/**
 * Tutto ciò che la Home mostra per un giorno, calcolato qui (funzioni pure, testate):
 * i componenti si limitano a disegnare.
 */

export interface HomeInput {
  /** Giorno mostrato, `AAAA-MM-GG` locale. */
  date: string;
  todayIso: string;
  nowMinutes: number;
  /** Piano alimentare attivo. */
  plan: DietPlan | null;
  /** Diario di quel giorno (vale solo se è dello stesso piano). */
  log: DietLogDay | undefined;
  workouts: readonly Workout[];
  /** Sessioni del periodo (si tengono quelle di quel giorno). */
  sessions: readonly Session[];
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
  /** Giorno del piano seguito (diverso da `weekday` con "oggi seguo il piano di un altro giorno"). */
  followsWeekday: number;
  swapped: boolean;
  hasPlan: boolean;
  view: DayView | null;
  eaten: Readonly<Record<string, boolean>>;
  dayType: ResolvedDayType;
  conflict: string;
  calories: HomeCalories | null;
  meal: MealFocus;
  /** Il pasto si segna solo oggi (come nella Dieta). */
  canTick: boolean;
  workouts: WorkoutEntry[];
  timeline: TimelineItem[];
  tip: Tip;
}

export function relationOf(date: string, todayIso: string): DayRelation {
  if (date === todayIso) return 'today';
  return date < todayIso ? 'past' : 'future';
}

/** Il diario vale solo se è del piano attivo (un piano nuovo riparte senza spunte). */
function logFor(plan: DietPlan | null, log: DietLogDay | undefined): DietLogDay | undefined {
  return plan && log && log.planId === plan.id ? log : undefined;
}

export function buildHomeDay(input: HomeInput): HomeDay {
  const { date, todayIso, nowMinutes, plan } = input;
  const weekday = isoWeekday(fromIsoDate(date));
  const relation = relationOf(date, todayIso);
  const log = logFor(plan, input.log);
  const followsWeekday = effectiveWeekday(weekday, log?.swappedFromWeekday);
  const eaten = relation === 'future' ? {} : (log?.eaten ?? {});

  const view = plan
    ? buildDayView(plan.payload, followsWeekday, {
        today: relation === 'today',
        keepEaten: relation === 'past',
        eaten,
        nowMinutes,
      })
    : null;

  const dayType = resolveDayType(plan?.payload ?? null, view?.day ?? null, workoutsOn(input.workouts, weekday).length);

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

  const workouts = workoutsForDay(input.workouts, input.sessions, date, weekday, relation === 'today' ? input.active : null);

  return {
    date,
    weekday,
    relation,
    followsWeekday,
    swapped: followsWeekday !== weekday,
    hasPlan: plan !== null,
    view,
    eaten,
    dayType,
    conflict: conflictText(dayType, relation === 'today'),
    calories,
    meal: focusMeal(plan !== null, view, eaten, nowMinutes, relation),
    canTick: relation === 'today' && view !== null,
    workouts,
    timeline: buildTimeline({ view, workouts, relation, nowMinutes, eaten }),
    tip: dailyTip(date, view?.observations ?? [], { dayTypeKey: dayType.key, hasPlan: plan !== null }),
  };
}

// --- Striscia dei 7 giorni ---

export interface HomeStripDay {
  date: string;
  weekday: number;
  initial: string;
  dayNumber: number;
  tone: DayTypeTone;
  typeLabel: string;
  isToday: boolean;
}

/** Le 7 date (lunedì–domenica) della settimana di oggi. */
export function weekDates(todayIso: string): string[] {
  const start = weekStartOf(fromIsoDate(todayIso));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
}

/** Striscia L–D: tipo di giornata di ogni giorno (con lo scambio del suo diario). */
export function homeWeek(
  todayIso: string,
  plan: DietPlan | null,
  logs: readonly DietLogDay[],
  workouts: readonly Workout[],
): HomeStripDay[] {
  return weekDates(todayIso).map((date, i) => {
    const weekday = i + 1;
    const log = logFor(
      plan,
      logs.find((l) => l.date === date),
    );
    const planDay = plan ? (findDay(plan.payload, effectiveWeekday(weekday, log?.swappedFromWeekday)) ?? null) : null;
    const type = resolveDayType(plan?.payload ?? null, planDay, workoutsOn(workouts, weekday).length);
    return {
      date,
      weekday,
      initial: WEEKDAY_INITIALS[i] ?? '',
      dayNumber: fromIsoDate(date).getDate(),
      tone: type.tone,
      typeLabel: type.label,
      isToday: date === todayIso,
    };
  });
}

/** "Ieri", "Domani", "Tra 3 giorni", "4 giorni fa" (oggi: ""). */
export function relativeDayWord(date: string, todayIso: string): string {
  const diff = Math.round((fromIsoDate(date).getTime() - fromIsoDate(todayIso).getTime()) / 86_400_000);
  if (diff === 0) return '';
  if (diff === -1) return 'Ieri';
  if (diff === 1) return 'Domani';
  return diff > 0 ? `Tra ${diff} giorni` : `${-diff} giorni fa`;
}
