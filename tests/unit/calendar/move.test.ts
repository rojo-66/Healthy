import { describe, expect, it } from 'vitest';
import {
  applyChange,
  chooseDay,
  conflictOptions,
  current,
  destinations,
  isComplete,
  isEmptyChange,
  moveChange,
  MoveError,
  resolveConflict,
  restoreChange,
  restoreWeekChange,
  skipChange,
  startMove,
  summaryLines,
  type ConflictOption,
  type MoveState,
} from '../../../src/lib/calendar/move';
import { buildCalendar, calendarWindow, occurrencesOn, type CalendarInput } from '../../../src/lib/calendar/occurrences';
import { input, key, move, runLog, session, skip, TODAY, workout } from './helpers';

/** Spostamenti, salti e conflitti (2c): macchina a stati pura. Oggi = lunedì 12; Petto lun, Gambe mer, Corsa gio, Spalle ven. */

const WINDOW = calendarWindow(TODAY);
const NOW = new Date(2026, 9, 12, 9, 0);
const occurrences = (patch: Partial<CalendarInput> = {}) => buildCalendar(WINDOW.from, WINDOW.to, input(patch)).occurrences;

const PETTO_12 = key('workout', 'petto', '2026-10-12');
const GAMBE_14 = key('workout', 'gambe', '2026-10-14');
const SPALLE_16 = key('workout', 'spalle', '2026-10-16');

function option(state: MoveState, which: ConflictOption) {
  return conflictOptions(state).find((o) => o.option === which)!;
}

/** Applica le eccezioni e ricalcola: dove sono finite le attività. */
function after(state: MoveState, patch: Partial<CalendarInput> = {}) {
  const edits = applyChange(patch.edits ?? [], moveChange(state, NOW));
  return occurrences({ ...patch, edits });
}

describe('spostamento semplice', () => {
  it('Petto da oggi a domani: riepilogo, eccezione, dove finisce', () => {
    let state = startMove(occurrences(), PETTO_12, TODAY);
    state = chooseDay(state, '2026-10-13');
    expect(isComplete(state)).toBe(true);
    expect(summaryLines(state)).toEqual(['Petto → mar 13']);
    const change = moveChange(state, NOW);
    expect(change.put).toEqual([move('workout', 'petto', '2026-10-12', '2026-10-13')].map((e) => ({ ...e, createdAt: NOW.toISOString() })));
    expect(occurrencesOn(after(state), '2026-10-13')[0]!.name).toBe('Petto');
  });

  it('destinazioni: da oggi a domenica prossima, non il giorno di partenza', () => {
    const state = startMove(occurrences(), PETTO_12, TODAY);
    const days = destinations(state);
    expect(days.map((d) => d.date)[0]).toBe(TODAY);
    expect(days.at(-1)!.date).toBe('2026-10-25');
    expect(days).toHaveLength(14);
    expect(days[0]).toMatchObject({ disabled: true, reason: 'giorno di partenza' });
    expect(days.find((d) => d.date === '2026-10-14')!.busy).toEqual(['Gambe']);
    expect(() => chooseDay(state, TODAY)).toThrow(MoveError);
    expect(() => chooseDay(state, '2026-10-26')).toThrow(MoveError);
  });

  it('riportata al giorno originale: l’eccezione si toglie', () => {
    const edits = [move('workout', 'petto', '2026-10-12', '2026-10-13')];
    const moved = occurrences({ edits }).find((o) => o.key === PETTO_12)!;
    expect(moved.date).toBe('2026-10-13');
    const state = chooseDay(startMove(occurrences({ edits }), PETTO_12, TODAY), TODAY);
    expect(moveChange(state, NOW)).toEqual({ put: [], remove: [PETTO_12], choicesRemove: [] });
  });
});

describe('conflitti', () => {
  const onGambe = () => chooseDay(startMove(occurrences(), PETTO_12, TODAY), '2026-10-14');

  it('il giorno occupato apre il conflitto con le 5 opzioni', () => {
    const state = onGambe();
    expect(state.conflict).toEqual({ date: '2026-10-14', others: [GAMBE_14] });
    expect(isComplete(state)).toBe(false);
    expect(conflictOptions(state).map((o) => [o.label, o.disabled])).toEqual([
      ['Scambia i due giorni', false],
      ["Sposta l'altra", false],
      ["Salta l'altra", false],
      ['Fai entrambe nello stesso giorno', false],
      ['Annulla', false],
    ]);
  });

  it('Scambia: Gambe va al giorno di Petto', () => {
    const state = resolveConflict(onGambe(), 'swap');
    expect(isComplete(state)).toBe(true);
    expect(summaryLines(state)).toEqual(['Petto → mer 14', 'Gambe → lun 12']);
    const result = after(state);
    expect(occurrencesOn(result, '2026-10-12').map((o) => o.name)).toEqual(['Gambe']);
    expect(occurrencesOn(result, '2026-10-14').map((o) => o.name)).toEqual(['Petto']);
  });

  it('Salta l’altra', () => {
    const state = resolveConflict(onGambe(), 'skip-other');
    expect(summaryLines(state)).toEqual(['Petto → mer 14', 'Gambe saltato']);
    const result = after(state);
    expect(occurrencesOn(result, '2026-10-14').map((o) => [o.name, o.status])).toEqual([
      ['Gambe', 'skipped'],
      ['Petto', 'todo'],
    ]);
    expect(moveChange(state, NOW).put.find((e) => e.refId === 'gambe')).toMatchObject({ action: 'skip', toDate: null });
  });

  it('Fai entrambe nello stesso giorno', () => {
    const state = resolveConflict(onGambe(), 'both');
    expect(summaryLines(state)).toEqual(['Petto → mer 14']);
    expect(occurrencesOn(after(state), '2026-10-14').map((o) => o.name)).toEqual(['Gambe', 'Petto']);
  });

  it('Annulla: si torna a scegliere il giorno per la stessa attività', () => {
    const state = resolveConflict(onGambe(), 'cancel');
    expect(state.conflict).toBeNull();
    expect(state.placements).toEqual([]);
    expect(current(state)!.key).toBe(PETTO_12);
    expect(destinations(state).find((d) => d.date === '2026-10-14')!.disabled).toBe(false);
  });

  it('Sposta l’altra: catena su tre giorni, senza cicli (i giorni usati non si riscelgono)', () => {
    let state = resolveConflict(onGambe(), 'move-other');
    expect(current(state)!.key).toBe(GAMBE_14);
    let days = destinations(state);
    expect(days.find((d) => d.date === TODAY)).toMatchObject({ disabled: true, reason: 'già usato' });
    expect(days.find((d) => d.date === '2026-10-14')).toMatchObject({ disabled: true, reason: 'giorno di partenza' });

    state = chooseDay(state, '2026-10-16'); // c'è Spalle
    expect(state.conflict).toEqual({ date: '2026-10-16', others: [SPALLE_16] });
    // Scambio: Gambe partirebbe da mer 14, dove ora c'è Petto → non si può.
    expect(option(state, 'swap')).toMatchObject({ disabled: true, reason: 'mer 14 ha già Petto' });
    state = resolveConflict(state, 'move-other');
    days = destinations(state);
    expect(days.filter((d) => d.disabled).map((d) => d.date)).toEqual([TODAY, '2026-10-14', '2026-10-16']);
    state = chooseDay(state, '2026-10-17');
    expect(isComplete(state)).toBe(true);
    expect(summaryLines(state)).toEqual(['Petto → mer 14', 'Gambe → ven 16', 'Spalle → sab 17']);
    const result = after(state);
    expect(['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-17'].map((d) => occurrencesOn(result, d).map((o) => o.name))).toEqual([
      [],
      ['Petto'],
      ['Gambe'],
      ['Spalle'],
    ]);
  });

  it('più attività sul giorno di arrivo: le opzioni valgono per tutte', () => {
    const addome = workout('addome', 'Addome', [3]);
    const occ = occurrences({ workouts: [workout('petto', 'Petto', [1]), workout('gambe', 'Gambe', [3]), addome] });
    let state = chooseDay(startMove(occ, PETTO_12, TODAY), '2026-10-14');
    expect(state.conflict!.others).toHaveLength(2);
    expect(option(state, 'move-other').label).toBe('Sposta le altre');
    state = resolveConflict(state, 'swap');
    expect(summaryLines(state)).toEqual(['Petto → mer 14', 'Addome → lun 12', 'Gambe → lun 12']);
  });
});

describe('recuperi e attività già fatte', () => {
  it('recupero di un’attività passata non fatta; Scambia disattivata (non si manda l’altra nel passato)', () => {
    const missed = key('workout', 'petto', '2026-10-05');
    let state = startMove(occurrences(), missed, TODAY);
    expect(destinations(state)[0]).toMatchObject({ date: TODAY, disabled: false, busy: ['Petto'] });
    state = chooseDay(state, '2026-10-14');
    expect(option(state, 'swap')).toMatchObject({ disabled: true, reason: 'lun 5 è già passato' });
    state = resolveConflict(state, 'both');
    expect(summaryLines(state)).toEqual(['Petto → mer 14']);
    const result = after(state);
    expect(occurrencesOn(result, '2026-10-05')).toEqual([]);
    expect(occurrencesOn(result, '2026-10-14').map((o) => [o.name, o.originalDate])).toEqual([
      ['Gambe', '2026-10-14'],
      ['Petto', '2026-10-05'],
    ]);
  });

  it('un’attività fatta non si sposta; sopra un’attività fatta resta solo "Fai entrambe"', () => {
    const occ = occurrences({ sessions: [session('petto', TODAY)] });
    expect(() => startMove(occ, PETTO_12, TODAY)).toThrow('non si può spostare');
    const state = chooseDay(startMove(occ, SPALLE_16, TODAY), TODAY);
    expect(conflictOptions(state).filter((o) => !o.disabled).map((o) => o.option)).toEqual(['both', 'cancel']);
    expect(option(state, 'skip-other').reason).toBe('Petto è già fatta');
    expect(() => resolveConflict(state, 'swap')).toThrow(MoveError);
  });

  it('una corsa fatta conta come fatta anche per i conflitti', () => {
    const occ = occurrences({ runLogs: [runLog('corsa', '2026-10-08')] });
    expect(() => startMove(occ, key('run', 'corsa', '2026-10-08'), TODAY)).toThrow(MoveError);
  });
});

describe('salta, ripristina, ripristina la settimana', () => {
  it('saltare e ripristinare un’attività', () => {
    const corsa = occurrences().find((o) => o.key === key('run', 'corsa', '2026-10-15'))!;
    const skipped = skipChange(corsa, NOW);
    expect(skipped.put[0]).toMatchObject({ action: 'skip', toDate: null, kind: 'run' });
    const occ = occurrences({ edits: applyChange([], skipped) });
    const again = occ.find((o) => o.key === corsa.key)!;
    expect(again.status).toBe('skipped');
    expect(restoreChange(again)).toEqual({ put: [], remove: [corsa.key], choicesRemove: [] });
  });

  it('Ripristina la settimana: toglie spostamenti, salti e diete scelte; una spostata già fatta resta', () => {
    const edits = [
      move('workout', 'petto', '2026-10-12', '2026-10-13'),
      skip('workout', 'gambe', '2026-10-14'),
      move('workout', 'spalle', '2026-10-09', '2026-10-12'), // dalla settimana scorsa, fatta oggi
      move('workout', 'spalle', '2026-10-23', '2026-10-24'), // settimana prossima: non si tocca
    ];
    const occ = occurrences({ edits, sessions: [session('spalle', TODAY)] });
    const change = restoreWeekChange('2026-10-12', edits, occ, [
      { date: '2026-10-15', dietType: 'run' },
      { date: '2026-10-22', dietType: 'run' },
    ]);
    expect(change.remove.sort()).toEqual([PETTO_12, GAMBE_14].sort());
    expect(change.choicesRemove).toEqual(['2026-10-15']);
    expect(isEmptyChange(change)).toBe(false);
    expect(isEmptyChange(restoreWeekChange('2026-10-19', [], occ, []))).toBe(true);
  });
});
