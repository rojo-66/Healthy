import type { CalendarChange } from '../../calendar/move';
import { db } from '../db';
import { parseOrThrow } from '../errors';
import { calendarEditSchema, dayChoiceSchema, type CalendarEdit, type DayChoice } from '../schemas/calendar';
import { getSetting } from './settings';
import { createTableRepo } from './table-repo';

/**
 * Calendario delle attività (2c): eccezioni per data (spostamenti, salti) e dieta scelta nei giorni con palestra e
 * corsa. Dati personali: escono dal telefono solo con il backup, mai con la condivisione.
 */
export const calendarEditsRepo = createTableRepo('calendarEdits');
export const dayChoicesRepo = createTableRepo('dayChoices');

export function listCalendarEdits(): Promise<CalendarEdit[]> {
  return db.calendarEdits.toArray();
}

export function listDayChoices(): Promise<DayChoice[]> {
  return db.dayChoices.toArray();
}

/** Primo giorno con il tipo di giornata dalle attività (`null` = sempre: database nato con il 2c). */
export function getCalendarStart(): Promise<string | null> {
  return getSetting('calendarStart');
}

/** Righe com'erano prima di un cambio: servono ad "Annulla". */
export interface CalendarUndo {
  edits: { key: string; before: CalendarEdit | null }[];
  choices: { date: string; before: DayChoice | null }[];
}

/**
 * Scrive un cambio del calendario in una sola transazione (tutto o niente) e restituisce le righe di prima.
 * Ogni riga passa dalla validazione zod prima di scrivere qualcosa.
 */
export async function applyCalendarChange(change: CalendarChange): Promise<CalendarUndo> {
  const puts = change.put.map((edit) => parseOrThrow(calendarEditSchema, edit));
  return db.transaction('rw', db.calendarEdits, db.dayChoices, async () => {
    const keys = [...new Set([...puts.map((e) => e.key), ...change.remove])];
    const before = await db.calendarEdits.bulkGet(keys);
    const choicesBefore = await db.dayChoices.bulkGet(change.choicesRemove);
    if (change.remove.length > 0) await db.calendarEdits.bulkDelete(change.remove);
    if (puts.length > 0) await db.calendarEdits.bulkPut(puts);
    if (change.choicesRemove.length > 0) await db.dayChoices.bulkDelete(change.choicesRemove);
    return {
      edits: keys.map((key, i) => ({ key, before: before[i] ?? null })),
      choices: change.choicesRemove.map((date, i) => ({ date, before: choicesBefore[i] ?? null })),
    };
  });
}

/** "Annulla": rimette le righe com'erano prima del cambio. */
export function undoCalendarChange(undo: CalendarUndo): Promise<void> {
  return db.transaction('rw', db.calendarEdits, db.dayChoices, async () => {
    for (const { key, before } of undo.edits) {
      if (before) await db.calendarEdits.put(before);
      else await db.calendarEdits.delete(key);
    }
    for (const { date, before } of undo.choices) {
      if (before) await db.dayChoices.put(before);
      else await db.dayChoices.delete(date);
    }
  });
}

/** Dieta scelta per una data con palestra e corsa; `null` la toglie (torna palestra). Restituisce la riga di prima. */
export function setDayChoice(date: string, dietType: DayChoice['dietType'] | null): Promise<CalendarUndo> {
  return db.transaction('rw', db.dayChoices, async () => {
    const before = (await db.dayChoices.get(date)) ?? null;
    if (dietType === null) await db.dayChoices.delete(date);
    else await db.dayChoices.put(parseOrThrow(dayChoiceSchema, { date, dietType }));
    return { edits: [], choices: [{ date, before }] };
  });
}
