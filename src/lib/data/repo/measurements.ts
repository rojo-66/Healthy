import { db } from '../db';
import { parseOrThrow, ValidationError } from '../errors';
import { newId } from '../ids';
import { measurementSchema, type Measurement } from '../schemas/measurements';
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

/**
 * Salva una misura nuova (senza `id`) o modificata. Una sola misura per data: se la data è già
 * usata da un'altra misura → `ValidationError`, nessuna scrittura (controllo e scrittura in una transazione).
 */
export async function saveMeasurement(input: Omit<Measurement, 'id'> & { id?: string }): Promise<Measurement> {
  const row = parseOrThrow(measurementSchema, { ...input, id: input.id ?? newId() });
  return db.transaction('rw', db.measurements, async () => {
    const sameDay = await db.measurements.where('date').equals(row.date).toArray();
    if (sameDay.some((m) => m.id !== row.id)) {
      const [y, mo, d] = row.date.split('-');
      throw new ValidationError([`Esiste già una misura del ${d}/${mo}/${y}: modificala dallo storico.`]);
    }
    await db.measurements.put(row);
    return row;
  });
}

export function deleteMeasurement(id: string): Promise<void> {
  return db.measurements.delete(id);
}
