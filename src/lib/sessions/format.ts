import { formatNumber } from '../components/stepper';
import type { WorkoutItem } from '../data/schemas/workouts';

const pad = (n: number) => String(n).padStart(2, '0');

/** Schema dell'esercizio: "4 × 10 · rec. 90 s"; piramidale "3 serie · 10–6 rip · rec. 120 s". */
export function schemeLabel(item: Pick<WorkoutItem, 'sets' | 'reps' | 'restSec' | 'setsDetail'>): string {
  const rest = `rec. ${item.restSec} s`;
  const detail = item.setsDetail;
  if (!detail || detail.length === 0) return `${item.sets} × ${item.reps} · ${rest}`;
  const first = detail[0]?.reps ?? item.reps;
  const last = detail[detail.length - 1]?.reps ?? item.reps;
  const reps = detail.every((d) => d.reps === first) ? String(first) : `${first}–${last}`;
  return `${item.sets} serie · ${reps} rip · ${rest}`;
}

/** Una serie: "57,5 × 10"; a corpo libero (0 kg) "12 rip". */
export function setLabel(kg: number, reps: number): string {
  return kg > 0 ? `${formatNumber(kg)} × ${reps}` : `${reps} rip`;
}

/** Orario locale "18:02" di un istante ISO. */
export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "1 esercizio", "6 esercizi". */
export function exercisesLabel(n: number): string {
  return n === 1 ? '1 esercizio' : `${n} esercizi`;
}

/**
 * Numero all'italiana con il punto delle migliaia anche a 4 cifre ("7.775", "2.227,5"):
 * `Intl` in italiano non raggruppa le migliaia sotto 10.000.
 */
export function groupedNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [int = '0', dec] = String(Math.abs(rounded)).split('.');
  const sign = rounded < 0 ? '−' : '';
  return `${sign}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${dec ? `,${dec}` : ''}`;
}

/** Volume: "7.775 kg". */
export function volumeLabel(kg: number): string {
  return `${groupedNumber(kg)} kg`;
}

/** Durata breve per lo Storico: "1:16" sopra l'ora, altrimenti "45’". */
export function durationShort(sec: number): string {
  const min = Math.floor(Math.max(0, sec) / 60);
  return min >= 60 ? `${Math.floor(min / 60)}:${pad(min % 60)}` : `${min}’`;
}

/** "18:02 → 19:18". */
export function timeRange(startIso: string, endIso: string | null): string {
  return endIso ? `${timeOfDay(startIso)} → ${timeOfDay(endIso)}` : `dalle ${timeOfDay(startIso)}`;
}
