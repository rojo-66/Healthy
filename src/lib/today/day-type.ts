import { lookup } from '../data/errors';
import type { DietPayload } from '../data/schemas/diet-payload';
import { dayTypeTone, type DayTypeTone } from '../diet/view';

/**
 * Tipo di giornata di una data (2c): un solo punto di scelta per Home, striscia, Dieta, spesa, Progressi e calendario.
 * - Decidono le attività del giorno (dopo spostamenti e salti): una scheda → palestra, una corsa → corsa, niente → riposo.
 *   Con palestra **e** corsa decide la scelta salvata per la data (senza scelta, palestra).
 * - Decide il piano alimentare (come prima del 2c) se non ci sono né schede né corse, o per i giorni prima
 *   dell'aggiornamento (`calendarStart`): lo storico non cambia.
 * - Se il piano non conosce quel tipo (niente "corsa" in `dayTypes`), restano pasti e target del giorno del piano.
 */

export interface ResolvedDayType {
  /** `gym`, `run`, `rest` o un'altra chiave del piano. */
  key: string;
  /** Testo del badge: "Giorno palestra", "Corsa", "Riposo" o l'etichetta del piano. */
  label: string;
  tone: DayTypeTone;
  /** Chi decide: il piano, le attività, la scelta tra palestra e corsa, o nessuno (riposo senza piano). */
  source: 'plan' | 'activities' | 'choice' | 'none';
  /** Palestra e corsa nello stesso giorno: si sceglie quale dieta seguire. */
  double: boolean;
  /** Tipo dalle attività che il piano non ha in `dayTypes` (es. "run"): restano pasti e target del piano. */
  missingType: string | null;
  /**
   * Tipo da chiedere al resolver delle varianti (`buildDayView`, `type`); `undefined` = quello predefinito del giorno.
   */
  request: string | undefined;
}

export interface DayTypeInput {
  date: string;
  /** Piano attivo (`null` se non c'è). */
  payload: DietPayload | null;
  /** Tipo predefinito del giorno del piano seguito (con lo scambio vecchio), `null` se non c'è. */
  planType: string | null;
  /** Attività del giorno (occorrenze non saltate + fuori programma). */
  activities: { gym: boolean; run: boolean };
  /** L'utente ha almeno una scheda o una corsa. */
  hasActivities: boolean;
  /** Dieta scelta per la data nei giorni con palestra e corsa. */
  choice: 'gym' | 'run' | null;
  /** Primo giorno con il tipo dalle attività; `null` = sempre. */
  calendarStart: string | null;
}

const BADGE: Readonly<Record<string, string>> = { gym: 'Giorno palestra', run: 'Corsa', rest: 'Riposo' };
/** Nome del tipo nelle frasi ("la dieta da palestra", "un giorno corsa"). */
export const TYPE_WORD: Readonly<Record<string, string>> = { gym: 'palestra', run: 'corsa', rest: 'riposo' };

function labelOf(payload: DietPayload | null, key: string): string {
  if (Object.hasOwn(BADGE, key)) return BADGE[key]!;
  return (payload && lookup(payload.dayTypes, key)?.label) || key;
}

function typed(
  payload: DietPayload | null,
  key: string,
  source: ResolvedDayType['source'],
  extra: Partial<ResolvedDayType> = {},
): ResolvedDayType {
  return { key, label: labelOf(payload, key), tone: dayTypeTone(key), source, double: false, missingType: null, request: undefined, ...extra };
}

/** Tipo del piano come prima del 2c: il piano se lo dice, altrimenti le attività, altrimenti riposo. */
function fromPlan(input: DayTypeInput): ResolvedDayType {
  const { payload, planType, activities } = input;
  if (payload && planType !== null && lookup(payload.dayTypes, planType)) return typed(payload, planType, 'plan');
  if (activities.gym) return typed(payload, 'gym', 'activities');
  if (activities.run) return typed(payload, 'run', 'activities');
  return typed(payload, 'rest', 'none');
}

export function dayTypeFor(input: DayTypeInput): ResolvedDayType {
  const { payload, activities } = input;
  const legacy = input.calendarStart !== null && input.date < input.calendarStart;
  if (!input.hasActivities || legacy) return fromPlan(input);

  const double = activities.gym && activities.run;
  const key = double ? (input.choice ?? 'gym') : activities.gym ? 'gym' : activities.run ? 'run' : 'rest';
  const source: ResolvedDayType['source'] = double && input.choice !== null ? 'choice' : 'activities';

  // Il piano non conosce questo tipo: restano pasti e target del giorno del piano, lo dice una riga gialla.
  if (payload && !lookup(payload.dayTypes, key)) return typed(payload, key, source, { double, missingType: key });
  return typed(payload, key, source, { double, request: payload ? key : undefined });
}

/** Riga gialla per un tipo che il piano non ha ("" se non serve). */
export function missingTypeText(type: ResolvedDayType): string {
  if (type.missingType === null) return '';
  const word = Object.hasOwn(TYPE_WORD, type.missingType) ? TYPE_WORD[type.missingType] : type.label.toLowerCase();
  return `Il piano alimentare non ha un giorno ${word}: pasti e target restano quelli del piano.`;
}
