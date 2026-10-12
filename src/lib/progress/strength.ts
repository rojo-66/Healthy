import type { Session, SessionSet } from '../data/schemas/sessions';
import type { Workout } from '../data/schemas/workouts';
import { addDays } from '../diet/calc/calendar';
import { sessionDate } from '../sessions/calendar';
import { sessionItems } from '../sessions/items';
import { recordTimeline, sessionItemKeys, type RecordSet } from '../sessions/records';
import { bestSet, volume } from '../sessions/stats';
import { inRange, mondayOf, weeksBetween, type DateRange } from './period';
import { pointsIn, type Point } from './series';

/**
 * Tab Forza (SPEC § 5.7, § 6.4). Solo sessioni concluse.
 * - Per ogni esercizio (stessa identità dei record M5: id della libreria o nome) e per ogni sessione:
 *   la serie migliore (kg più alti, a parità più ripetizioni, `bestSet` M5) e il volume Σ kg × rip
 *   delle serie fatte (`volume` M5). Un esercizio presente due volte nella sessione conta una volta sola.
 * - Record personali con la regola M5 (`recordTimeline`, stessa logica di `sessionRecords`).
 * - Nei grafici solo gli esercizi con almeno 2 sessioni con una serie fatta con carico (kg > 0).
 */

export interface StrengthPoint extends Point {
  sessionId: string;
  /** Serie migliore. */
  kg: number;
  reps: number;
  volume: number;
  /** Record della sessione per questo esercizio (il più pesante), con il valore precedente. */
  record: RecordSet | null;
}

export interface ExerciseHistory {
  key: string;
  /** Nome della sessione più recente. */
  name: string;
  /** Posizione nella sessione più recente (per l'ordine dei chip). */
  order: number;
  points: StrengthPoint[];
}

export type StrengthIndex = Map<string, ExerciseHistory>;

const chronological = (a: Session, b: Session) => a.startedAt.localeCompare(b.startedAt);

/** Indice per esercizio di tutto lo storico: si calcola una volta per ogni cambio dei dati. */
export function strengthIndex(sessions: readonly Session[]): StrengthIndex {
  const done = sessions.filter((s) => s.endedAt !== null).sort(chronological);
  const records = recordTimeline(done);
  const index: StrengthIndex = new Map();

  for (const session of done) {
    const keys = sessionItemKeys(session);
    const items = sessionItems(session);
    const byKey = new Map<string, { name: string; order: number; sets: SessionSet[] }>();
    for (const set of session.sets) {
      const key = keys[set.itemIndex];
      if (!key || !set.done) continue;
      const entry = byKey.get(key) ?? { name: items[set.itemIndex]?.name ?? '', order: set.itemIndex, sets: [] };
      entry.sets.push(set);
      byKey.set(key, entry);
    }
    for (const [key, { name, order, sets }] of byKey) {
      const best = bestSet(sets);
      if (!best || best.kg <= 0) continue;
      const record =
        (records.get(session.id) ?? [])
          .filter((r) => r.key === key)
          .sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0] ?? null;
      const history = index.get(key) ?? { key, name, order, points: [] };
      if (name) history.name = name;
      history.order = order;
      history.points.push({
        date: sessionDate(session),
        value: best.kg,
        sessionId: session.id,
        kg: best.kg,
        reps: best.reps,
        volume: volume(sets),
        record,
      });
      index.set(key, history);
    }
  }
  return index;
}

/**
 * Esercizi da scegliere (chip): almeno 2 sessioni; prima i più frequenti, poi i più recenti,
 * poi nell'ordine della scheda.
 */
export function exerciseChoices(index: StrengthIndex): ExerciseHistory[] {
  const lastDate = (h: ExerciseHistory) => h.points[h.points.length - 1]?.date ?? '';
  return [...index.values()]
    .filter((h) => h.points.length >= 2)
    .sort(
      (a, b) =>
        b.points.length - a.points.length ||
        lastDate(b).localeCompare(lastDate(a)) ||
        a.order - b.order ||
        a.name.localeCompare(b.name, 'it'),
    );
}

export type StrengthMetric = 'load' | 'volume';

export interface ExerciseView {
  points: StrengthPoint[];
  /** Valori del grafico: carico migliore o volume. */
  series: Point[];
  sessions: number;
  records: number;
  /** Migliore del periodo: carico più alto (con le ripetizioni) o volume più alto. */
  best: StrengthPoint | null;
  /** Ultimo meno primo del periodo; `null` con meno di 2 sessioni. */
  delta: number | null;
}

export function exerciseView(history: ExerciseHistory | undefined, metric: StrengthMetric, range: DateRange | null): ExerciseView {
  const points = history ? pointsIn(history.points, range) : [];
  const series = points.map((p) => ({ date: p.date, value: metric === 'load' ? p.kg : p.volume }));
  let best: StrengthPoint | null = null;
  for (const p of points) {
    if (!best) best = p;
    else if (metric === 'volume' ? p.volume > best.volume : p.kg > best.kg || (p.kg === best.kg && p.reps > best.reps)) best = p;
  }
  const first = series[0];
  const last = series[series.length - 1];
  return {
    points,
    series,
    sessions: points.length,
    records: points.filter((p) => p.record).length,
    best,
    delta: first && last && series.length >= 2 ? Math.round((last.value - first.value) * 100) / 100 : null,
  };
}

export interface WeekBar {
  /** Lunedì della settimana. */
  monday: string;
  /** Sessioni concluse nella settimana. */
  count: number;
  /** Volume della settimana in kg (Σ kg × rip delle serie fatte). */
  volumeKg: number;
  /** Settimana in corso (parziale). */
  current: boolean;
}

export interface WeeklyWorkouts {
  weeks: WeekBar[];
  /** Obiettivo = somma dei giorni assegnati nelle schede attuali (scelta confermata in M9); `null` se nessuno. */
  target: number | null;
}

/** Allenamenti per settimana (da lunedì a domenica), comprese le settimane a zero. */
export function weeklyWorkouts(sessions: readonly Session[], workouts: readonly Pick<Workout, 'weekdays'>[], range: DateRange | null, todayIso: string): WeeklyWorkouts {
  const assigned = workouts.reduce((sum, w) => sum + w.weekdays.length, 0);
  const target = assigned > 0 ? assigned : null;
  if (!range) return { weeks: [], target };
  const current = mondayOf(todayIso);
  const weeks = weeksBetween(range.from, range.to).map((monday) => ({ monday, count: 0, volumeKg: 0, current: monday === current }));
  const byMonday = new Map(weeks.map((w) => [w.monday, w]));
  for (const s of sessions) {
    if (s.endedAt === null) continue;
    const date = sessionDate(s);
    if (!inRange(date, range)) continue;
    const week = byMonday.get(mondayOf(date));
    if (!week) continue;
    week.count += 1;
    week.volumeKg = Math.round((week.volumeKg + volume(s.sets)) * 100) / 100;
  }
  return { weeks, target };
}

export interface RecentRecord {
  key: string;
  name: string;
  date: string;
  kg: number;
  reps: number;
  previousKg: number;
}

/** Record del periodo, dal più recente. */
export function recentRecords(index: StrengthIndex, range: DateRange | null, limit = 5): RecentRecord[] {
  const out: RecentRecord[] = [];
  for (const h of index.values()) {
    for (const p of pointsIn(h.points, range)) {
      if (p.record) out.push({ key: h.key, name: h.name, date: p.date, kg: p.record.kg, reps: p.record.reps, previousKg: p.record.previousKg });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'it')).slice(0, limit);
}

/** Ultimo giorno della settimana (domenica). */
export function weekEnd(monday: string): string {
  return addDays(monday, 6);
}
