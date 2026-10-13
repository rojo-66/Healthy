import { z } from 'zod';
import { entityId, isoDate, isoDateTime } from './common';

/**
 * Calendario delle attività (2c). Le occorrenze (un'attività in una data) si calcolano dalla ricorrenza settimanale
 * delle schede e delle corse; qui si salvano solo le **eccezioni** di una data e la dieta scelta nei giorni con due
 * attività. Dati personali: non si condividono mai (solo backup).
 */

export const activityKindSchema = z.enum(['workout', 'run']);
export type ActivityKind = z.infer<typeof activityKindSchema>;

/** Chiave stabile di un'occorrenza: `workout:<id>:2026-10-12` (data originale, dalla ricorrenza). */
export function occurrenceKey(kind: ActivityKind, refId: string, originalDate: string): string {
  return `${kind}:${refId}:${originalDate}`;
}

/**
 * Eccezione per un'occorrenza: spostata in un altro giorno (`move`, con `toDate`) o saltata (`skip`; `toDate` = il
 * giorno in cui era stata spostata, se lo era, altrimenti `null`). Al massimo una per occorrenza (la chiave è quella
 * dell'occorrenza). Non cambia mai la scheda o la corsa.
 */
export const calendarEditSchema = z
  .object({
    key: z.string().max(100),
    kind: activityKindSchema,
    refId: entityId,
    /** Data dell'occorrenza nella ricorrenza settimanale. */
    originalDate: isoDate,
    action: z.enum(['move', 'skip']),
    /** Giorno in cui è stata spostata; `null` = la data originale (solo per `skip`). */
    toDate: isoDate.nullable(),
    createdAt: isoDateTime,
  })
  .superRefine((edit, ctx) => {
    if (edit.key !== occurrenceKey(edit.kind, edit.refId, edit.originalDate)) {
      ctx.addIssue({ code: 'custom', path: ['key'], message: 'chiave dell’occorrenza non coerente' });
    }
    if (edit.action === 'move' && (edit.toDate === null || edit.toDate === edit.originalDate)) {
      ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'manca il giorno in cui è stata spostata' });
    }
    if (edit.action === 'skip' && edit.toDate === edit.originalDate) {
      ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'giorno di arrivo uguale a quello originale' });
    }
  });

/** Dieta scelta per una data con palestra e corsa (senza scelta vale palestra). */
export const dayChoiceSchema = z.object({
  date: isoDate,
  dietType: z.enum(['gym', 'run']),
});

export type CalendarEdit = z.infer<typeof calendarEditSchema>;
export type DayChoice = z.infer<typeof dayChoiceSchema>;
