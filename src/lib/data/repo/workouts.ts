import { db } from '../db';
import type { Workout } from '../schemas/workouts';
import { createTableRepo } from './table-repo';

export const workoutsRepo = createTableRepo('workouts');

/** Schede dalla modificata più di recente. */
export function listWorkoutsRecent(): Promise<Workout[]> {
  return db.workouts.orderBy('updatedAt').reverse().toArray();
}

/** Schede assegnate a un giorno della settimana (1 = lunedì; indice multiEntry `*weekdays`). */
export function workoutsForWeekday(weekday: number): Promise<Workout[]> {
  return db.workouts.where('weekdays').equals(weekday).toArray();
}
