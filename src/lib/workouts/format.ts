import { formatNumber } from '../components/stepper';
import type { Workout } from '../data/schemas/workouts';
import { cardioSuffix, workoutTotals, type TimedItem } from './calc/duration';

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

/** "6 esercizi · 20 serie"; una scheda solo cardio: "2 cardio". */
function countsLabel(t: { exercises: number; sets: number; cardio: number }): string {
  if (t.exercises === 0) return `${t.cardio} cardio`;
  const ex = t.exercises === 1 ? '1 esercizio' : `${t.exercises} esercizi`;
  const sets = t.sets === 1 ? '1 serie' : `${t.sets} serie`;
  return `${ex} · ${sets}`;
}

/** Riga dei dati della card: "6 esercizi · 20 serie · ~75’" (cardio compreso nei minuti). */
export function workoutMeta(w: { items: readonly TimedItem[] }): string {
  const t = workoutTotals(w);
  return `${countsLabel(t)} · ~${t.totalMin}’`;
}

/** Riga della card "Prossimo": "5 esercizi · 18 serie · ~70’ + 12’ Tapis roulant · corsa". */
export function nextMeta(w: { items: readonly TimedItem[] }): string {
  const t = workoutTotals(w);
  if (t.exercises === 0) return `${countsLabel(t)} · ~${t.cardioMin}’`;
  const base = `${countsLabel(t)} · ~${t.strengthMin}’`;
  const cardio = cardioSuffix(w.items);
  return cardio ? `${base} ${cardio}` : base;
}

const AUTHOR_MAX = 14;

/**
 * Etichetta origine: "PT · v3" (gialla) o "TUA" (grigia) per le mie schede; per quelle ricevute (M8)
 * autore e versione, "MARCO · v2" (o "RICEVUTA · v2" senza autore). Il colore lo decide `source`:
 * giallo se chi l'ha mandata l'aveva creata come PT, grigio se era la scheda personale di un amico.
 */
export function originLabel(w: Pick<Workout, 'source' | 'version' | 'author' | 'received'>): string {
  if (w.received) {
    const name = w.author.trim().toLocaleUpperCase('it-IT');
    if (name === '') return `RICEVUTA · v${w.version}`;
    const short = name.length > AUTHOR_MAX ? `${name.slice(0, AUTHOR_MAX).trimEnd()}…` : name;
    return `${short} · v${w.version}`;
  }
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

/** Valore di `<input type="time">` ("18:00", anche "18:00:00") → `HH:MM`; vuoto o non valido → `null`. */
export function parseTimeInput(value: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

/** `HH:MM` + minuti → `HH:MM` (oltre la mezzanotte riparte da 00:00). */
export function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((((h ?? 0) * 60 + (m ?? 0) + Math.round(minutes)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Orario della scheda con la fine stimata: "18:00–19:15"; senza orario `''`. */
export function workoutTimeRange(w: { time: string | null; items: readonly TimedItem[] }): string {
  if (!w.time) return '';
  return `${w.time}–${addMinutesToTime(w.time, workoutTotals(w).totalMin)}`;
}
