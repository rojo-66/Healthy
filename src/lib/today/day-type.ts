import { lookup } from '../data/errors';
import type { DietDay, DietPayload } from '../data/schemas/diet-payload';
import { dayTypeTone, type DayTypeTone } from '../diet/view';

/**
 * Tipo di giornata della Home (badge e colore del titolo). Vince il piano alimentare, perché decide i
 * target; se il piano non lo dice, decide la scheda assegnata; altrimenti è riposo.
 * I conflitti non cambiano il tipo: si dichiarano.
 */

/**
 * - `plan-not-gym-with-workout`: il piano dice riposo o corsa, ma quel giorno c'è una scheda;
 * - `plan-gym-without-workout`: il piano dice palestra, ma non c'è una scheda.
 */
export type DayTypeConflict = 'plan-not-gym-with-workout' | 'plan-gym-without-workout';

export interface ResolvedDayType {
  /** `gym`, `run`, `rest` o un'altra chiave del piano. */
  key: string;
  /** Testo del badge: "Giorno palestra", "Corsa", "Riposo" o l'etichetta del piano. */
  label: string;
  tone: DayTypeTone;
  source: 'plan' | 'workout' | 'none';
  conflict: DayTypeConflict | null;
}

const BADGE: Readonly<Record<string, string>> = { gym: 'Giorno palestra', run: 'Corsa', rest: 'Riposo' };
/** Tipi del piano che non sono palestra: con una scheda assegnata è un conflitto da dichiarare. */
const NOT_GYM = new Set(['rest', 'run']);

/**
 * @param payload piano attivo (`null` se non c'è)
 * @param planDay giorno del piano seguito quel giorno (con lo scambio), `null` se non è nel piano
 * @param workoutCount schede assegnate a quel giorno della settimana
 */
export function resolveDayType(
  payload: DietPayload | null,
  planDay: DietDay | null,
  workoutCount: number,
): ResolvedDayType {
  const typeKey = planDay?.type ?? null;
  const planType = payload && typeKey !== null ? lookup(payload.dayTypes, typeKey) : undefined;
  if (typeKey !== null && planType) {
    let conflict: DayTypeConflict | null = null;
    if (NOT_GYM.has(typeKey) && workoutCount > 0) conflict = 'plan-not-gym-with-workout';
    if (typeKey === 'gym' && workoutCount === 0) conflict = 'plan-gym-without-workout';
    return {
      key: typeKey,
      label: (Object.hasOwn(BADGE, typeKey) ? BADGE[typeKey] : undefined) ?? planType.label,
      tone: dayTypeTone(typeKey),
      source: 'plan',
      conflict,
    };
  }
  if (workoutCount > 0) return { key: 'gym', label: 'Giorno palestra', tone: 'training', source: 'workout', conflict: null };
  return { key: 'rest', label: 'Riposo', tone: 'muted', source: 'none', conflict: null };
}

/** Frase del conflitto, da mostrare in giallo nella card allenamento ("" se non c'è). */
export function conflictText(type: ResolvedDayType, isToday: boolean): string {
  const day = isToday ? 'di oggi' : 'di questo giorno';
  if (type.conflict === 'plan-not-gym-with-workout') {
    return `Il piano alimentare ${day} è da giorno di ${type.label.toLowerCase()}: i target restano quelli del piano.`;
  }
  if (type.conflict === 'plan-gym-without-workout') {
    return `Il piano alimentare ${day} è da giorno palestra, ma non c'è una scheda assegnata.`;
  }
  return '';
}
