import { nowIso } from '../data/ids';
import { occurrenceKey, type CalendarEdit, type DayChoice } from '../data/schemas/calendar';
import { weekdayName } from '../data/schemas/diet-payload';
import { addDays, fromIsoDate } from '../diet/calc/calendar';
import { calendarWindow, canReschedule, compareOccurrences, datesBetween, weekdayOfIso, type CalendarWindow, type Occurrence } from './occurrences';

/**
 * Spostare e saltare le attività (2c): macchina a stati pura, testata; l'interfaccia (MoveSheet) si limita a disegnare.
 * - Origine: un'occorrenza non fatta né in corso della finestra (settimana scorsa, questa, prossima), anche passata
 *   (recupero). Destinazione: da oggi a domenica prossima, mai l'origine né un giorno già usato nella catena.
 * - Se il giorno scelto ha altre attività: conflitto con Scambia, Sposta l'altra, Salta l'altra, Fai entrambe, Annulla.
 *   "Sposta l'altra" continua la catena con l'altra attività; i giorni già usati non si riscelgono (niente cicli).
 * - Uno spostamento è un'eccezione della data: la scheda (o la corsa) non cambia.
 */

/** Cosa scrivere nel database: eccezioni da salvare, eccezioni e scelte della dieta da togliere. */
export interface CalendarChange {
  put: CalendarEdit[];
  remove: string[];
  /** Date di cui togliere la dieta scelta. */
  choicesRemove: string[];
}

export const EMPTY_CHANGE: CalendarChange = { put: [], remove: [], choicesRemove: [] };

export type ConflictOption = 'swap' | 'move-other' | 'skip-other' | 'both' | 'cancel';

export interface Placement {
  key: string;
  /** Giorno di arrivo, oppure `skip` (saltata). */
  to: string | 'skip';
}

export interface MoveState {
  todayIso: string;
  window: CalendarWindow;
  occurrences: readonly Occurrence[];
  /** Decisioni prese finora, nell'ordine. */
  placements: Placement[];
  /** Attività ancora da collocare: la prima è quella di adesso. */
  queue: string[];
  /** Giorni già usati nella catena (partenza e arrivi). */
  used: string[];
  /** Giorno scelto occupato da altre attività (chiavi), in attesa di un'opzione. */
  conflict: { date: string; others: string[] } | null;
}

export interface Destination {
  date: string;
  disabled: boolean;
  /** "giorno di partenza", "già usato" (vuoto se si può scegliere). */
  reason: string;
  /** Attività che ci sono già quel giorno (dopo le decisioni prese). */
  busy: string[];
}

export interface OptionState {
  option: ConflictOption;
  label: string;
  disabled: boolean;
  /** Perché non si può (vuoto se si può). */
  reason: string;
}

export class MoveError extends Error {}

/** "mar 13" */
export function shortDay(iso: string): string {
  return `${weekdayName(weekdayOfIso(iso)).slice(0, 3).toLowerCase()} ${fromIsoDate(iso).getDate()}`;
}

function occ(state: Pick<MoveState, 'occurrences'>, key: string): Occurrence {
  const found = state.occurrences.find((o) => o.key === key);
  if (!found) throw new MoveError('Attività non trovata');
  return found;
}

function placementOf(state: MoveState, key: string): Placement | undefined {
  for (let i = state.placements.length - 1; i >= 0; i--) if (state.placements[i]!.key === key) return state.placements[i];
  return undefined;
}

/** Giorno effettivo dopo le decisioni prese; `null` se saltata. */
function dateAfter(state: MoveState, o: Occurrence): string | null {
  const p = placementOf(state, o.key);
  if (p) return p.to === 'skip' ? null : p.to;
  return o.skipped ? null : o.date;
}

/** Attività (non saltate) in un giorno dopo le decisioni prese, tranne quelle indicate. */
function activitiesOn(state: MoveState, date: string, except: readonly string[]): Occurrence[] {
  return state.occurrences.filter((o) => !except.includes(o.key) && dateAfter(state, o) === date).sort(compareOccurrences);
}

const locked = (o: Occurrence) => o.status === 'done' || o.status === 'in-progress';

export function startMove(occurrences: readonly Occurrence[], key: string, todayIso: string): MoveState {
  const window = calendarWindow(todayIso);
  const o = occurrences.find((x) => x.key === key);
  if (!o) throw new MoveError('Attività non trovata');
  if (!canReschedule(o, window)) throw new MoveError('Questa attività non si può spostare');
  return { todayIso, window, occurrences, placements: [], queue: [key], used: [o.date], conflict: null };
}

/** Attività da collocare adesso (`null` a catena finita). */
export function current(state: MoveState): Occurrence | null {
  const key = state.queue[0];
  return key === undefined ? null : occ(state, key);
}

export function isComplete(state: MoveState): boolean {
  return state.queue.length === 0 && state.conflict === null;
}

/** Giorni possibili per l'attività di adesso: da oggi a domenica prossima. */
export function destinations(state: MoveState): Destination[] {
  const now = current(state);
  if (!now) return [];
  const from = state.todayIso > state.window.from ? state.todayIso : state.window.from;
  return datesBetween(from, state.window.to).map((date) => {
    const origin = date === now.date;
    const used = !origin && state.used.includes(date);
    return {
      date,
      disabled: origin || used,
      reason: origin ? 'giorno di partenza' : used ? 'già usato' : '',
      busy: activitiesOn(state, date, [now.key]).map((o) => o.name),
    };
  });
}

export function chooseDay(state: MoveState, date: string): MoveState {
  const now = current(state);
  if (!now || state.conflict) throw new MoveError('Prima risolvi il conflitto');
  const target = destinations(state).find((d) => d.date === date);
  if (!target || target.disabled) throw new MoveError('Giorno non disponibile');
  const next: MoveState = {
    ...state,
    placements: [...state.placements, { key: now.key, to: date }],
    used: [...state.used, date],
  };
  const others = activitiesOn(next, date, [now.key]);
  if (others.length > 0) return { ...next, conflict: { date, others: others.map((o) => o.key) } };
  return { ...next, queue: state.queue.slice(1) };
}

/** Opzioni del conflitto, con quelle che non si possono usare e il motivo. */
export function conflictOptions(state: MoveState): OptionState[] {
  const now = current(state);
  const conflict = state.conflict;
  if (!now || !conflict) return [];
  const others = conflict.others.map((k) => occ(state, k));
  const plural = others.length > 1;
  const blocker = others.find(locked);
  const lockedReason = blocker ? `${blocker.name} è già ${blocker.status === 'done' ? 'fatta' : 'in corso'}` : '';

  let swapReason = lockedReason;
  if (!swapReason && now.date < state.todayIso) swapReason = `${shortDay(now.date)} è già passato`;
  if (!swapReason) {
    const there = activitiesOn(state, now.date, [now.key, ...conflict.others]);
    if (there.length > 0) swapReason = `${shortDay(now.date)} ha già ${there[0]!.name}`;
  }
  return [
    { option: 'swap', label: 'Scambia i due giorni', disabled: swapReason !== '', reason: swapReason },
    { option: 'move-other', label: plural ? 'Sposta le altre' : "Sposta l'altra", disabled: lockedReason !== '', reason: lockedReason },
    { option: 'skip-other', label: plural ? 'Salta le altre' : "Salta l'altra", disabled: lockedReason !== '', reason: lockedReason },
    { option: 'both', label: 'Fai entrambe nello stesso giorno', disabled: false, reason: '' },
    { option: 'cancel', label: 'Annulla', disabled: false, reason: '' },
  ];
}

export function resolveConflict(state: MoveState, option: ConflictOption): MoveState {
  const now = current(state);
  const conflict = state.conflict;
  if (!now || !conflict) throw new MoveError('Nessun conflitto');
  const choice = conflictOptions(state).find((o) => o.option === option);
  if (!choice || choice.disabled) throw new MoveError(choice?.reason || 'Opzione non disponibile');
  const rest = state.queue.slice(1);
  switch (option) {
    case 'swap':
      return {
        ...state,
        placements: [...state.placements, ...conflict.others.map((key) => ({ key, to: now.date }))],
        queue: rest,
        conflict: null,
      };
    case 'move-other':
      return { ...state, queue: [...conflict.others, ...rest], conflict: null };
    case 'skip-other':
      return { ...state, placements: [...state.placements, ...conflict.others.map((key) => ({ key, to: 'skip' as const }))], queue: rest, conflict: null };
    case 'both':
      return { ...state, queue: rest, conflict: null };
    case 'cancel':
      // Si torna alla scelta del giorno per la stessa attività.
      return { ...state, placements: state.placements.slice(0, -1), used: state.used.slice(0, -1), conflict: null };
  }
}

/** Decisioni finali, una per attività (l'ultima vince), nell'ordine in cui sono state prese. */
function finalPlacements(state: MoveState): Placement[] {
  const out: Placement[] = [];
  for (const p of state.placements) {
    const at = out.findIndex((x) => x.key === p.key);
    if (at === -1) out.push(p);
    else out[at] = p;
  }
  return out;
}

const skippedWord = (o: Occurrence) => (o.kind === 'run' ? 'saltata' : 'saltato');

/** Riepilogo prima della conferma: "Petto → mar 13 · Gambe → gio 15 · Spalle saltato". */
export function summaryLines(state: MoveState): string[] {
  return finalPlacements(state).map((p) => {
    const o = occ(state, p.key);
    return p.to === 'skip' ? `${o.name} ${skippedWord(o)}` : `${o.name} → ${shortDay(p.to)}`;
  });
}

function editFor(o: Occurrence, action: CalendarEdit['action'], toDate: string | null, now: Date): CalendarEdit {
  return {
    key: occurrenceKey(o.kind, o.refId, o.originalDate),
    kind: o.kind,
    refId: o.refId,
    originalDate: o.originalDate,
    action,
    toDate: toDate === o.originalDate ? null : toDate,
    createdAt: nowIso(now),
  };
}

/** Eccezioni da scrivere per le decisioni prese (riportare alla data originale toglie l'eccezione). */
export function moveChange(state: MoveState, now: Date = new Date()): CalendarChange {
  const change: CalendarChange = { put: [], remove: [], choicesRemove: [] };
  for (const p of finalPlacements(state)) {
    const o = occ(state, p.key);
    if (p.to === 'skip') change.put.push(editFor(o, 'skip', o.date, now));
    else if (p.to === o.originalDate) change.remove.push(o.key);
    else change.put.push(editFor(o, 'move', p.to, now));
  }
  return change;
}

/** Salta un'attività: resta nel giorno in cui è (anche se era stata spostata), barrata. */
export function skipChange(o: Occurrence, now: Date = new Date()): CalendarChange {
  return { put: [editFor(o, 'skip', o.date, now)], remove: [], choicesRemove: [] };
}

/** Ripristina un'attività: torna com'era nel piano (giorno originale, non saltata). */
export function restoreChange(o: Occurrence): CalendarChange {
  return { put: [], remove: [o.key], choicesRemove: [] };
}

/**
 * "Ripristina la settimana": toglie spostamenti e salti delle attività con la data originale (o di arrivo) in quella
 * settimana e le diete scelte di quei giorni. Un'attività già fatta nel giorno in cui era stata spostata resta lì.
 */
export function restoreWeekChange(
  monday: string,
  edits: readonly CalendarEdit[],
  occurrences: readonly Occurrence[],
  choices: readonly DayChoice[],
): CalendarChange {
  const sunday = addDays(monday, 6);
  const inWeek = (date: string | null) => date !== null && date >= monday && date <= sunday;
  const done = new Set(occurrences.filter(locked).map((o) => o.key));
  return {
    put: [],
    remove: edits.filter((e) => (inWeek(e.originalDate) || inWeek(e.toDate)) && !done.has(e.key)).map((e) => e.key),
    choicesRemove: choices.filter((c) => inWeek(c.date)).map((c) => c.date),
  };
}

export function isEmptyChange(change: CalendarChange): boolean {
  return change.put.length === 0 && change.remove.length === 0 && change.choicesRemove.length === 0;
}

/** Eccezioni dopo il cambio (anteprima, senza scrivere niente). */
export function applyChange(edits: readonly CalendarEdit[], change: CalendarChange): CalendarEdit[] {
  const byKey = new Map(edits.map((e) => [e.key, e]));
  for (const key of change.remove) byKey.delete(key);
  for (const edit of change.put) byKey.set(edit.key, edit);
  return [...byKey.values()];
}

/** Scelte della dieta dopo il cambio. */
export function applyChoiceChange(choices: readonly DayChoice[], change: CalendarChange): DayChoice[] {
  return choices.filter((c) => !change.choicesRemove.includes(c.date));
}
