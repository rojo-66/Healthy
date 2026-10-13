import type { DietPlan } from '../data/schemas/diet-plans';
import { fromIsoDate, WEEKDAY_INITIALS } from '../diet/calc/calendar';
import type { ResolvedDayType } from '../today/day-type';
import { occurrenceTag } from '../workouts/calc/week';
import { dietView, type DayInfo } from './days';
import type { ActivityKind } from '../data/schemas/calendar';
import type { OccurrenceStatus } from './occurrences';

/**
 * Celle del calendario di 3 settimane (2c), funzione pura: per ogni giorno le attività (in programma, spostate,
 * fatte, saltate), il tipo di dieta e, per i giorni passati e oggi, i pasti segnati in % e le kcal mangiate.
 */

export interface CellActivity {
  key: string;
  kind: ActivityKind;
  /** Sigla (PET, COR…). */
  tag: string;
  name: string;
  moved: boolean;
  status: OccurrenceStatus;
}

export interface CalendarCell {
  date: string;
  weekday: number;
  initial: string;
  dayNumber: number;
  isToday: boolean;
  past: boolean;
  activities: CellActivity[];
  type: ResolvedDayType;
  /** Pasti segnati (oggi e giorni passati, con un piano): `null` se non si calcola. */
  meals: { eaten: number; planned: number; pct: number | null; kcal: number } | null;
}

export function calendarCells(infos: readonly DayInfo[], plan: DietPlan | null, todayIso: string): CalendarCell[] {
  return infos.map((info) => {
    let meals: CalendarCell['meals'] = null;
    if (plan && info.date <= todayIso) {
      const view = dietView(info, plan, { today: false, keepEaten: true, nowMinutes: 0 });
      if (view) {
        const eaten = view.meals.filter((m) => m.eaten).length;
        const planned = view.meals.length;
        meals = { eaten, planned, pct: planned > 0 ? Math.round((eaten / planned) * 100) : null, kcal: Math.round(view.eatenTotals.total.kcal) };
      }
    }
    return {
      date: info.date,
      weekday: info.weekday,
      initial: WEEKDAY_INITIALS[info.weekday - 1] ?? '',
      dayNumber: fromIsoDate(info.date).getDate(),
      isToday: info.date === todayIso,
      past: info.date < todayIso,
      activities: info.occurrences.map((o) => ({ key: o.key, kind: o.kind, tag: occurrenceTag(o), name: o.name, moved: o.moved, status: o.status })),
      type: info.type,
      meals,
    };
  });
}

/** Livello del colore dei pasti segnati, come il calendario dei Progressi (meno di 60 · 60 · 80 · 100 %). */
export function heatLevel(pct: number | null): 'none' | 'low' | '60' | '80' | '100' {
  if (pct === null) return 'none';
  if (pct >= 100) return '100';
  if (pct >= 80) return '80';
  if (pct >= 60) return '60';
  return 'low';
}
