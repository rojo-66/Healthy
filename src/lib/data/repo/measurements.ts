import { db } from '../db';
import type { Measurement } from '../schemas/measurements';
import { createTableRepo } from './table-repo';

export const measurementsRepo = createTableRepo('measurements');

/** Misure dalla più vecchia alla più recente. */
export function listMeasurementsByDate(): Promise<Measurement[]> {
  return db.measurements.orderBy('date').toArray();
}

/** Misure tra due giorni compresi (`AAAA-MM-GG`). */
export function measurementsBetween(from: string, to: string): Promise<Measurement[]> {
  return db.measurements.where('date').between(from, to, true, true).sortBy('date');
}
