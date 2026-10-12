import type { DietLogDay } from '../data/schemas/diet-log';
import type { DietPlan } from '../data/schemas/diet-plans';
import { addDays, effectiveWeekday, fromIsoDate, isoWeekday, toIsoDate } from '../diet/calc/calendar';
import type { Macros } from '../diet/calc/nutrients';
import {
  DEVIATION_FIELDS,
  DEVIATION_THRESHOLD_PCT,
  deviations,
  OBSERVATION_DISCLAIMER,
  signed,
} from '../diet/calc/observations';
import type { DayTargets, TargetOrigin } from '../diet/calc/targets';
import { formatInt } from '../diet/format';
import { buildDayView } from '../diet/view';
import { logFor } from '../today/home';
import { weeksBetween } from './period';

/**
 * Tab Dieta (SPEC § 5.7). Parte dal primo giorno del piano attivo; ogni giorno usa il piano del suo
 * diario (`dietLog.planId`, se esiste ancora) con lo scambio del giorno, altrimenti il piano attivo.
 * Tutti i calcoli sono quelli di M3 (`buildDayView`: pasti non vuoti, spunte, totali, target).
 * Oggi è "in corso": si mostra ma non entra nelle medie.
 */

export interface MealRef {
  key: string;
  label: string;
  /** Posizione tra i pasti del giorno (per scegliere a parità). */
  order: number;
}

export interface DietDayStat {
  date: string;
  /** Oggi (in corso) o un giorno concluso. */
  today: boolean;
  planId: string;
  /** Giorno della settimana seguito (scambio compreso). */
  weekday: number;
  /** Pasti previsti non vuoti e pasti segnati. */
  planned: number;
  eaten: number;
  /** Pasti segnati / previsti in %; `null` se il giorno non ha pasti previsti. */
  pct: number | null;
  /** Pasti previsti non segnati, nell'ordine del piano. */
  missed: MealRef[];
  /** Totali dei pasti segnati e se tutti i loro alimenti hanno valori. */
  eatenTotals: Macros;
  eatenComplete: boolean;
  targets: DayTargets | null;
  targetOrigin: TargetOrigin | null;
}

/** Data locale di un istante ISO. */
const localDay = (iso: string) => toIsoDate(new Date(iso));

/**
 * Primo giorno del piano attivo: il più tardo tra `validFrom` e il giorno dell'importazione (prima non ci
 * possono essere spunte). Senza nessuno dei due, il primo giorno del suo diario; `null` se non si sa.
 */
export function dietStart(plan: Pick<DietPlan, 'id' | 'validFrom' | 'importedAt'>, logs: readonly DietLogDay[]): string | null {
  const dates = [plan.validFrom, plan.importedAt ? localDay(plan.importedAt) : null].filter((d): d is string => d !== null);
  if (dates.length > 0) return dates.sort().at(-1) ?? null;
  const own = logs.filter((l) => l.planId === plan.id).map((l) => l.date).sort();
  return own[0] ?? null;
}

/** Statistiche di ogni giorno dall'inizio del piano attivo fino a oggi compreso. */
export function dietDays(plans: readonly DietPlan[], logs: readonly DietLogDay[], todayIso: string): DietDayStat[] {
  const active = plans.find((p) => p.active);
  if (!active) return [];
  const start = dietStart(active, logs);
  if (start === null || start > todayIso) return [];
  const byId = new Map(plans.map((p) => [p.id, p]));
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const out: DietDayStat[] = [];

  for (let date = start; date <= todayIso; date = addDays(date, 1)) {
    const row = byDate.get(date);
    const plan = (row && byId.get(row.planId)) || active;
    const log = logFor(plan, row);
    const weekday = effectiveWeekday(isoWeekday(fromIsoDate(date)), log?.swappedFromWeekday);
    const view = buildDayView(plan.payload, weekday, { today: false, keepEaten: true, eaten: log?.eaten ?? {}, nowMinutes: 0 });
    const meals = view?.meals ?? [];
    const eaten = meals.filter((m) => m.eaten).length;
    out.push({
      date,
      today: date === todayIso,
      planId: plan.id,
      weekday,
      planned: meals.length,
      eaten,
      pct: meals.length > 0 ? (eaten / meals.length) * 100 : null,
      missed: meals.flatMap((m, order) => (m.eaten ? [] : [{ key: m.key, label: m.label, order }])),
      eatenTotals: view?.eatenTotals.total ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      eatenComplete: view?.eatenTotals.complete ?? false,
      targets: view?.resolved?.targets ?? null,
      targetOrigin: view?.resolved?.origin ?? null,
    });
  }
  return out;
}

/** Giorni conclusi (oggi escluso) con pasti previsti: entrano nelle medie dell'aderenza. */
export function concludedDays(days: readonly DietDayStat[]): DietDayStat[] {
  return days.filter((d) => !d.today && d.pct !== null);
}

export interface AdherenceSummary {
  /** Media dei giorni conclusi, intera; `null` senza giorni conclusi. */
  average: number | null;
  days: number;
  perfect: number;
  mostSkipped: { key: string; label: string; times: number } | null;
}

export function adherenceSummary(days: readonly DietDayStat[]): AdherenceSummary {
  const done = concludedDays(days);
  const average = done.length ? Math.round(done.reduce((s, d) => s + (d.pct ?? 0), 0) / done.length) : null;
  const skipped = new Map<string, { label: string; times: number; order: number }>();
  for (const d of done) {
    for (const m of d.missed) {
      const entry = skipped.get(m.key) ?? { label: m.label, times: 0, order: m.order };
      entry.times += 1;
      entry.order = Math.min(entry.order, m.order);
      skipped.set(m.key, entry);
    }
  }
  let most: AdherenceSummary['mostSkipped'] = null;
  let mostOrder = Infinity;
  for (const [key, e] of skipped) {
    if (!most || e.times > most.times || (e.times === most.times && e.order < mostOrder)) {
      most = { key, label: e.label, times: e.times };
      mostOrder = e.order;
    }
  }
  return { average, days: done.length, perfect: done.filter((d) => d.pct === 100).length, mostSkipped: most };
}

export type HeatLevel = 'low' | '60' | '80' | '100' | 'none';

export function heatLevel(pct: number | null): HeatLevel {
  if (pct === null) return 'none';
  if (pct >= 100) return '100';
  if (pct >= 80) return '80';
  if (pct >= 60) return '60';
  return 'low';
}

export interface HeatCell {
  date: string;
  pct: number | null;
  level: HeatLevel;
  today: boolean;
}

/** Calendario "Pasti segnati": una riga per settimana (lunedì–domenica), dal primo giorno a oggi. */
export function heatmapWeeks(days: readonly DietDayStat[], todayIso: string): { monday: string; cells: HeatCell[] }[] {
  const first = days[0];
  if (!first) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  return weeksBetween(first.date, todayIso).map((monday) => ({
    monday,
    cells: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const day = byDate.get(date);
      const pct = day?.pct ?? null;
      return { date, pct: pct === null ? null : Math.round(pct), level: heatLevel(pct), today: date === todayIso };
    }),
  }));
}

export interface DeviationDay {
  date: string;
  kcal: number;
  target: number;
  pct: number;
  /** Oltre la soglia del 5 % (la stessa delle osservazioni M3). */
  out: boolean;
}

export interface DeviationSummary {
  days: DeviationDay[];
  excluded: { noMeals: number; incomplete: number; noTarget: number };
}

/** Giorni conclusi confrontabili con il target: almeno un pasto segnato, valori completi, un target. */
function comparable(d: DietDayStat): 'ok' | 'noMeals' | 'incomplete' | 'noTarget' {
  if (d.eaten === 0) return 'noMeals';
  if (!d.eatenComplete) return 'incomplete';
  if (!d.targets || d.targets.kcal <= 0) return 'noTarget';
  return 'ok';
}

/** Scarto dal target: (kcal mangiate − target del giorno) / target, in %. */
export function targetDeviation(days: readonly DietDayStat[]): DeviationSummary {
  const out: DeviationDay[] = [];
  const excluded = { noMeals: 0, incomplete: 0, noTarget: 0 };
  for (const d of concludedDays(days)) {
    const why = comparable(d);
    if (why !== 'ok') {
      excluded[why] += 1;
      continue;
    }
    const target = d.targets!.kcal;
    const pct = ((d.eatenTotals.kcal - target) / target) * 100;
    out.push({ date: d.date, kcal: d.eatenTotals.kcal, target, pct, out: Math.abs(pct) >= DEVIATION_THRESHOLD_PCT });
  }
  return { days: out, excluded };
}

export type MacroField = 'protein' | 'carbs' | 'fat';

export interface MacroAverage {
  field: MacroField;
  name: string;
  eaten: number;
  target: number | null;
  /** Scarto dal target in %; `null` senza target. */
  pct: number | null;
  out: boolean;
}

export interface MacroSummary {
  days: number;
  kcal: { eaten: number; target: number } | null;
  rows: MacroAverage[];
}

const MACRO_NAMES: Readonly<Record<MacroField, string>> = { protein: 'Proteine', carbs: 'Carboidrati', fat: 'Grassi' };

const mean = (values: readonly number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

/** Media dei macro mangiati sui giorni conclusi confrontabili, rispetto alla media dei target degli stessi giorni. */
export function macroAverages(days: readonly DietDayStat[]): MacroSummary {
  const ok = concludedDays(days).filter((d) => comparable(d) === 'ok');
  const kcalEaten = mean(ok.map((d) => d.eatenTotals.kcal));
  const kcalTarget = mean(ok.map((d) => d.targets!.kcal));
  const rows = (['protein', 'carbs', 'fat'] as const).map((field): MacroAverage => {
    const eaten = mean(ok.map((d) => d.eatenTotals[field])) ?? 0;
    const target = mean(ok.flatMap((d) => (d.targets?.[field] != null ? [d.targets[field]!] : [])));
    const pct = target !== null && target > 0 ? ((eaten - target) / target) * 100 : null;
    return { field, name: MACRO_NAMES[field], eaten, target, pct, out: pct !== null && Math.abs(pct) >= DEVIATION_THRESHOLD_PCT };
  });
  return { days: ok.length, kcal: kcalEaten !== null && kcalTarget !== null ? { eaten: kcalEaten, target: kcalTarget } : null, rows };
}

export interface DietObservation {
  kind: 'deviation' | 'aligned' | 'none';
  text: string;
  disclaimer: string;
}

const ARTICLE: Readonly<Record<string, string>> = { calorie: 'Le', proteine: 'Le', carboidrati: 'I', grassi: 'I' };

/**
 * Osservazione dell'app sui valori medi (soglia e campi delle osservazioni M3): segnala lo scarto
 * maggiore se ≥ 5 %. Solo una segnalazione: l'app non modifica il piano.
 */
export function dietObservation(macros: MacroSummary): DietObservation {
  const disclaimer = OBSERVATION_DISCLAIMER;
  if (!macros.kcal || macros.days === 0) {
    return { kind: 'none', text: 'Segna i pasti per qualche giorno: qui vedrai il confronto con il target.', disclaimer };
  }
  const byField = new Map(macros.rows.map((r) => [r.field, r]));
  const totals = {
    total: {
      kcal: macros.kcal.eaten,
      protein: byField.get('protein')?.eaten ?? 0,
      carbs: byField.get('carbs')?.eaten ?? 0,
      fat: byField.get('fat')?.eaten ?? 0,
      fiber: 0,
    },
    missing: [],
    fiberMissing: [],
    itemCount: 1,
    complete: true,
  };
  const resolved = {
    targets: {
      kcal: macros.kcal.target,
      protein: byField.get('protein')?.target ?? null,
      carbs: byField.get('carbs')?.target ?? null,
      fat: byField.get('fat')?.target ?? null,
      fiber: null,
    },
    origin: 'nutritionist' as const,
  };
  const top = deviations(totals, resolved)[0];
  if (!top || Math.abs(top.pct) < DEVIATION_THRESHOLD_PCT) {
    return {
      kind: 'aligned',
      text: `In media sei in linea con il target: calorie e macro entro il ${DEVIATION_THRESHOLD_PCT}%, calcolati sui pasti che hai segnato.`,
      disclaimer,
    };
  }
  const info = DEVIATION_FIELDS.find((f) => f.field === top.field)!;
  const eaten = totals.total[top.field];
  const target = resolved.targets[top.field] ?? 0;
  const pct = String(Math.round(Math.abs(top.pct)));
  const feminine = ARTICLE[info.name] === 'Le';
  return {
    kind: 'deviation',
    text:
      `${ARTICLE[info.name] ?? 'I'} ${info.name} sono in media del ${pct}% ${top.diff > 0 ? 'sopra' : 'sotto'} il target ` +
      `(${formatInt(eaten)} ${info.unit} su ${formatInt(target)} ${info.unit}, ${signed(pct, top.diff)}%), ${feminine ? 'calcolate' : 'calcolati'} sui pasti che hai segnato. ` +
      'Se ti sembra strano, chiedi conferma al nutrizionista.',
    disclaimer,
  };
}
