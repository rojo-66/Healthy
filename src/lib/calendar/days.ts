import type { DayChoice } from '../data/schemas/calendar';
import type { DietLogDay, MealsFrom } from '../data/schemas/diet-log';
import type { DietPlan } from '../data/schemas/diet-plans';
import { buildDayView, findDay, type DayView } from '../diet/view';
import { dayTypeFor, type ResolvedDayType } from '../today/day-type';
import { applyChange, applyChoiceChange, shortDay, type CalendarChange } from './move';
import {
  buildCalendar,
  calendarWindow,
  datesBetween,
  dayActivities,
  occurrencesOn,
  weekdayOfIso,
  type CalendarDays,
  type CalendarInput,
  type Occurrence,
} from './occurrences';

/**
 * Giorni del calendario con la loro dieta (2c): tipo di giornata, diario e richiesta per il resolver delle varianti.
 * Funzioni pure: Home, Dieta, spesa, calendario e Progressi passano da qui.
 */

export interface DietContext {
  /** Piano attivo. */
  plan: DietPlan | null;
  /** Diario (si usa solo quello del piano attivo). */
  logs: readonly DietLogDay[];
  choices: readonly DayChoice[];
  /** Primo giorno con il tipo dalle attività (`null` = sempre). */
  calendarStart: string | null;
}

export interface DayInfo {
  date: string;
  weekday: number;
  type: ResolvedDayType;
  /** Diario del giorno, solo se è del piano attivo. */
  log: DietLogDay | undefined;
  /** Scambio vecchio (2b) ancora valido per quella data. */
  mealsFrom: MealsFrom | null;
  occurrences: Occurrence[];
}

/** Il diario vale solo se è del piano attivo (un piano nuovo riparte senza spunte). */
export function logFor(plan: DietPlan | null, log: DietLogDay | undefined): DietLogDay | undefined {
  return plan && log && log.planId === plan.id ? log : undefined;
}

/** Ci sono schede o corse: allora il tipo di giornata viene dalle attività. */
export function hasActivities(input: Pick<CalendarInput, 'workouts' | 'runs'>): boolean {
  return input.workouts.length > 0 || input.runs.length > 0;
}

export function dayInfo(date: string, days: CalendarDays, input: CalendarInput, diet: DietContext): DayInfo {
  const weekday = weekdayOfIso(date);
  const log = logFor(diet.plan, diet.logs.find((l) => l.date === date));
  const mealsFrom = log?.mealsFrom ?? null;
  const payload = diet.plan?.payload ?? null;
  const planType = payload ? (findDay(payload, weekday, { mealsFrom })?.defaultType ?? null) : null;
  const type = dayTypeFor({
    date,
    payload,
    planType,
    activities: dayActivities(days, date, input.active ?? null),
    hasActivities: hasActivities(input),
    choice: diet.choices.find((c) => c.date === date)?.dietType ?? null,
    calendarStart: diet.calendarStart,
  });
  return { date, weekday, type, log, mealsFrom, occurrences: occurrencesOn(days.occurrences, date) };
}

/** Giorni tra `from` e `to` (compresi), con il calendario calcolato una volta sola. */
export function dayInfos(from: string, to: string, input: CalendarInput, diet: DietContext): { days: CalendarDays; infos: DayInfo[] } {
  const days = buildCalendar(from, to, input);
  return { days, infos: datesBetween(from, to).map((date) => dayInfo(date, days, input, diet)) };
}

export interface DayViewWith {
  today: boolean;
  /** Giorni passati: si vedono le spunte, in sola lettura. */
  keepEaten?: boolean;
  nowMinutes: number;
}

/** Vista della dieta di un giorno: variante del tipo di giornata, pasti spuntati com'erano. */
export function dietView(info: DayInfo, plan: DietPlan | null, options: DayViewWith): DayView | null {
  if (!plan) return null;
  return buildDayView(plan.payload, info.weekday, {
    type: info.type.request,
    mealsFrom: info.mealsFrom,
    mealSources: info.log?.mealSources,
    eaten: info.log?.eaten ?? {},
    today: options.today,
    keepEaten: options.keepEaten,
    nowMinutes: options.nowMinutes,
  });
}

/** Fonte del pasto da salvare con la spunta: giorno e variante da cui arriva adesso. */
export function sourceOf(view: DayView): MealsFrom {
  return { weekday: view.sourceWeekday, type: view.sourceType };
}

// --- Effetto sulla dieta di uno spostamento, prima della conferma ---

export interface DietImpact {
  date: string;
  /** "mar 13". */
  day: string;
  from: ResolvedDayType;
  to: ResolvedDayType;
  /** Kcal del piano prima e dopo (con i pasti già segnati com'erano). */
  kcalFrom: number | null;
  kcalTo: number | null;
  /** Ci sono pasti già segnati: restano com'erano. */
  keepsTicked: boolean;
}

/** Giorni della finestra in cui il tipo di giornata cambierebbe con `change`. */
export function dietImpact(change: CalendarChange, input: CalendarInput, diet: DietContext): DietImpact[] {
  const window = calendarWindow(input.todayIso);
  const before = dayInfos(window.from, window.to, input, diet).infos;
  const afterInput = { ...input, edits: applyChange(input.edits, change) };
  const afterDiet = { ...diet, choices: applyChoiceChange(diet.choices, change) };
  const after = dayInfos(window.from, window.to, afterInput, afterDiet).infos;
  const out: DietImpact[] = [];
  before.forEach((b, i) => {
    const a = after[i]!;
    if (a.type.key === b.type.key && a.type.request === b.type.request) return;
    const options = { today: false, keepEaten: b.date <= input.todayIso, nowMinutes: 0 };
    const kcal = (info: DayInfo) => dietView(info, diet.plan, options)?.plan.total.kcal ?? null;
    out.push({
      date: b.date,
      day: shortDay(b.date),
      from: b.type,
      to: a.type,
      kcalFrom: kcal(b),
      kcalTo: kcal(a),
      keepsTicked: b.date <= input.todayIso && Object.values(b.log?.eaten ?? {}).some(Boolean),
    });
  });
  return out;
}
