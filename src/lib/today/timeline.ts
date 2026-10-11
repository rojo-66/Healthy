import type { DietMeal } from '../data/schemas/diet-payload';
import { currentMealKey, isEmptyMeal, mealStartMinutes, toMinutes } from '../diet/calc/meal-now';
import type { DayView } from '../diet/view';
import type { DayRelation } from './meal-focus';
import { normalize } from '../workouts/library/search';
import type { WorkoutEntry } from './workout-day';

/**
 * Timeline della giornata (Home): pasti, allenamento e integratori in ordine di orario.
 * Stati: `done` fatto · `now` adesso · `next` dopo · `missed` non segnato (passato) ·
 * `skipped` integratore "non serve oggi" (barrato).
 */
export type TimelineState = 'done' | 'now' | 'next' | 'missed' | 'skipped';
export type TimelineKind = 'meal' | 'workout' | 'supplement';

export interface TimelineItem {
  /** Chiave stabile (`meal:pranzo`, `workout:<id>`, `supp:0`): niente doppioni con `{#each}`. */
  id: string;
  kind: TimelineKind;
  label: string;
  /** "13:00", oppure il testo di `when` di un integratore non collegato, oppure "". */
  time: string;
  state: TimelineState;
}

export interface TimelineInput {
  view: DayView | null;
  workouts: readonly WorkoutEntry[];
  relation: DayRelation;
  nowMinutes: number;
  eaten: Readonly<Record<string, boolean>>;
}

const DAY_END = 24 * 60;
/** Voci senza orario: in fondo, nell'ordine (prima gli allenamenti, poi gli integratori non collegati). */
const NO_TIME_WORKOUT = 100_000;
const NO_TIME_SUPPLEMENT = 200_000;

const PRE_WORKOUT = /\bpre[\s-]?(workout|allenamento|palestra)\b/;
const POST_WORKOUT = /\bpost[\s-]?(workout|allenamento|palestra)\b/;
const TRAINING = /palestra|allenamento|workout/;
const BEFORE = /\b(prima|pre)\b/;

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Placed {
  item: TimelineItem;
  sort: number;
  seq: number;
}

/** Fine del pasto: fine della finestra, oppure inizio del pasto dopo (come il pasto del momento). */
function mealEnd(meal: DietMeal, later: readonly DietMeal[]): number | null {
  if (meal.window) {
    const [start, end] = meal.window.map(toMinutes) as [number, number];
    return end >= start ? end : null; // a cavallo della mezzanotte: non si dice "passato"
  }
  const start = mealStartMinutes(meal);
  if (start === null) return null;
  return later.map(mealStartMinutes).find((m): m is number => m !== null && m > start) ?? DAY_END;
}

function workoutState(e: WorkoutEntry, relation: DayRelation, now: number): TimelineState {
  if (e.status === 'done') return 'done';
  if (e.status === 'in-progress') return 'now';
  if (relation === 'past') return 'missed';
  if (relation === 'future' || e.startMinutes === null) return 'next';
  if (now < e.startMinutes) return 'next';
  return now < e.startMinutes + (e.durationMin ?? 0) ? 'now' : 'missed';
}

export function buildTimeline({ view, workouts, relation, nowMinutes, eaten }: TimelineInput): TimelineItem[] {
  const placed: Placed[] = [];
  let seq = 0;
  const add = (item: TimelineItem, sort: number) => placed.push({ item, sort, seq: seq++ });

  // --- Pasti (quelli vuoti non si mostrano, come nella Dieta) ---
  const meals = (view?.day.meals ?? []).filter((m) => !isEmptyMeal(m));
  const currentKey = relation === 'today' && view ? currentMealKey(view.day.meals, eaten, nowMinutes) : null;
  const mealSort = new Map<string, number>();
  const mealState = new Map<string, TimelineState>();
  const mealTime = new Map<string, string>();
  let previous = -1;
  meals.forEach((meal, i) => {
    const start = mealStartMinutes(meal);
    const sort = start ?? previous + 0.01;
    previous = sort;
    const isEaten = Object.hasOwn(eaten, meal.key) && eaten[meal.key] === true;
    let state: TimelineState;
    if (relation === 'future') state = 'next';
    else if (isEaten) state = 'done';
    else if (relation === 'past') state = 'missed';
    else if (meal.key === currentKey) state = 'now';
    else {
      const end = mealEnd(meal, meals.slice(i + 1));
      state = end !== null && end <= nowMinutes ? 'missed' : 'next';
    }
    // Si mostra l'orario del pasto (come nella Dieta); si ordina per inizio della finestra.
    const time = meal.time ?? (start === null ? '' : clock(start));
    mealSort.set(meal.key, sort);
    mealState.set(meal.key, state);
    mealTime.set(meal.key, time);
    add({ id: `meal:${meal.key}`, kind: 'meal', label: meal.name ? `${meal.label} · ${meal.name}` : meal.label, time, state }, sort);
  });

  // --- Allenamenti: orario (reale o della scheda), altrimenti vicino ai pasti pre/post-workout, altrimenti in fondo ---
  const mealText = (m: DietMeal) => normalize(`${m.key} ${m.label} ${m.name}`);
  const post = meals.find((m) => POST_WORKOUT.test(mealText(m)));
  const pre = meals.find((m) => PRE_WORKOUT.test(mealText(m)));
  const workoutSort = new Map<string, number>();
  workouts.forEach((e, i) => {
    let sort: number;
    if (e.startMinutes !== null) sort = e.startMinutes;
    else if (post) sort = mealSort.get(post.key)! - 0.5;
    else if (pre) sort = mealSort.get(pre.key)! + 0.5;
    else sort = NO_TIME_WORKOUT + i * 10;
    workoutSort.set(e.id, sort);
    add(
      {
        id: `workout:${e.id}`,
        kind: 'workout',
        label: `Palestra · ${e.name}`,
        time: e.startMinutes === null ? '' : clock(e.startMinutes),
        state: workoutState(e, relation, nowMinutes),
      },
      sort,
    );
  });

  // --- Integratori: dopo il pasto o vicino all'allenamento indicato in `when`, altrimenti in fondo ---
  const firstWorkout = workouts[0];
  (view?.supplements ?? []).forEach((s, i) => {
    const when = normalize(s.when);
    const label = [s.name, s.dose].filter(Boolean).join(' · ');
    let sort = NO_TIME_SUPPLEMENT + i;
    let time = s.when;
    let state: TimelineState = relation === 'past' ? 'missed' : 'next';

    const meal =
      when === ''
        ? undefined
        : meals.find((m) => {
            const key = normalize(m.key);
            const name = normalize(m.label);
            return when === key || when === name || new RegExp(`\\b${escape(name)}\\b`).test(when);
          });
    if (firstWorkout && TRAINING.test(when)) {
      const w = workoutSort.get(firstWorkout.id)!;
      sort = w + (BEFORE.test(when) ? -0.3 : 0.3) + i * 0.001;
      time = firstWorkout.startMinutes === null ? '' : clock(firstWorkout.startMinutes);
      state = workoutState(firstWorkout, relation, nowMinutes);
    } else if (meal) {
      sort = mealSort.get(meal.key)! + 0.2 + i * 0.001;
      time = mealTime.get(meal.key)!;
      state = mealState.get(meal.key)!;
    }
    if (s.skip) state = 'skipped';
    add({ id: `supp:${i}`, kind: 'supplement', label, time, state }, sort);
  });

  return placed
    .sort((a, b) => (a.sort === b.sort ? a.seq - b.seq : a.sort - b.sort))
    .map((p) => p.item);
}
