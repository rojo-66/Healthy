import { formatNumber } from '../components/stepper';
import type { Workout } from '../data/schemas/workouts';
import { workoutTotals } from './calc/duration';

/** Sigle dei giorni (1 = lunedì). */
export const WEEKDAY_SHORT = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'] as const;

export function weekdayShort(weekday: number): string {
  return WEEKDAY_SHORT[weekday - 1] ?? '';
}

/** "LUN · GIO"; "—" se la scheda non ha giorni. */
export function weekdaysLabel(weekdays: readonly number[]): string {
  if (weekdays.length === 0) return '—';
  return [...weekdays]
    .sort((a, b) => a - b)
    .map(weekdayShort)
    .join(' · ');
}

/** Kg come nel mockup: "57,5"; 0 → "—" (corpo libero). */
export function kgLabel(kg: number): string {
  return kg > 0 ? formatNumber(kg) : '—';
}

/** "4 × 10 · 57,5 kg · rec 90 s"; con serie diverse "4 serie · 10–6 rip · 55–65 kg · rec 90 s". */
export function itemSummary(item: {
  sets: number;
  reps: number;
  kg: number;
  restSec: number;
  setsDetail: readonly { reps: number; kg: number }[] | null;
}): string {
  const rest = `rec ${item.restSec} s`;
  if (!item.setsDetail || item.setsDetail.length === 0) {
    return `${item.sets} × ${item.reps} · ${kgLabel(item.kg)} kg · ${rest}`;
  }
  return `${item.sets} serie · ${range(item.setsDetail.map((s) => s.reps))} rip · ${range(item.setsDetail.map((s) => s.kg), true)} kg · ${rest}`;
}

function range(values: readonly number[], kg = false): string {
  const fmt = (n: number) => (kg ? kgLabel(n) : String(n));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? fmt(min) : `${fmt(values[0] ?? min)}–${fmt(values[values.length - 1] ?? max)}`;
}

/** Riga dei dati della card: "6 esercizi · 20 serie · ~75’". */
export function workoutMeta(w: Pick<Workout, 'items' | 'cardio'>): string {
  const t = workoutTotals(w);
  const ex = t.exercises === 1 ? '1 esercizio' : `${t.exercises} esercizi`;
  const sets = t.sets === 1 ? '1 serie' : `${t.sets} serie`;
  return `${ex} · ${sets} · ~${t.totalMin}’`;
}

/** Riga della card "Prossimo": "5 esercizi · 18 serie · ~70’ + 12’ tapis roulant". */
export function nextMeta(w: Pick<Workout, 'items' | 'cardio'>): string {
  const t = workoutTotals(w);
  const ex = t.exercises === 1 ? '1 esercizio' : `${t.exercises} esercizi`;
  const base = `${ex} · ${t.sets} serie · ~${t.strengthMin}’`;
  return w.cardio && w.cardio.minutes > 0 ? `${base} + ${w.cardio.minutes}’ ${w.cardio.type}` : base;
}

/** Etichetta origine: "PT · v3" (gialla) o "TUA" (grigia). */
export function originLabel(w: Pick<Workout, 'source' | 'version'>): string {
  return w.source === 'pt' ? `PT · v${w.version}` : 'TUA';
}

/** "oggi", "domani", "tra 3 giorni". */
export function relativeDay(inDays: number): string {
  if (inDays <= 0) return 'oggi';
  if (inDays === 1) return 'domani';
  return `tra ${inDays} giorni`;
}

/** Ultima esecuzione (le sessioni arrivano nel M5). */
export function lastRunLabel(lastIso: string | null): string {
  if (!lastIso) return 'mai eseguita';
  const d = new Date(lastIso);
  const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `ultima: ${d.getDate()} ${months[d.getMonth()]}`;
}
