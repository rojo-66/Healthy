import { describe, expect, it } from 'vitest';
import { validate } from '../../../src/lib/data/errors';
import { sessionSchema } from '../../../src/lib/data/schemas/sessions';
import {
  cardioCounts,
  cardioEntry,
  lastCardioTable,
  pauseCardioClock,
  setCardioValues,
  startCardioClock,
  toggleCardioDone,
} from '../../../src/lib/sessions/cardio';
import { finish, toggleSet } from '../../../src/lib/sessions/edit';
import { cardioDoneLabel, cardioPlanLabel } from '../../../src/lib/sessions/format';
import { optionalInputValue, parseOptional } from '../../../src/lib/sessions/input';
import {
  crossedTarget,
  elapsedMinutes,
  elapsedMs,
  pauseClock,
  reachedTarget,
  resetClock,
  startClock,
  STOPPED,
} from '../../../src/lib/sessions/stopwatch';
import { summarize } from '../../../src/lib/sessions/summary';
import { newSession, START, valid } from './helpers';

/** Cardio come esercizio nella sessione live (2a). Orologio simulato: si passano gli istanti. */

const T0 = START.getTime();
const MIN = 60_000;
/** Il cardio della scheda finta è l'ultimo esercizio (indice 3), 12 minuti previsti. */
const CARDIO = 3;

describe('cronometro (a istanti, come il recupero)', () => {
  it('avvia, pausa, riprendi: il tempo si accumula', () => {
    let c = startClock(STOPPED, T0);
    expect(elapsedMs(c, T0 + 90_000)).toBe(90_000);
    c = pauseClock(c, T0 + 90_000);
    expect(elapsedMs(c, T0 + 10 * MIN)).toBe(90_000); // in pausa non scorre
    c = startClock(c, T0 + 10 * MIN);
    expect(elapsedMs(c, T0 + 11 * MIN)).toBe(150_000);
    expect(startClock(c, T0 + 12 * MIN)).toBe(c); // già in corso: invariato
    expect(pauseClock(pauseClock(c, T0 + 12 * MIN), T0 + 13 * MIN)).toEqual(pauseClock(c, T0 + 12 * MIN));
    expect(resetClock()).toEqual(STOPPED);
  });

  it('sospensione di iOS: al ritorno il tempo è giusto (nessun contatore perso)', () => {
    const c = startClock(STOPPED, T0);
    // Nessun "tick" per 8 minuti: conta solo l'istante di partenza.
    expect(elapsedMs(c, T0 + 8 * MIN)).toBe(8 * MIN);
  });

  it('tempo previsto: raggiunto una volta sola, mai in ritardo dopo una sospensione lunga', () => {
    const c = startClock(STOPPED, T0);
    expect(reachedTarget(c, 12, T0 + 12 * MIN - 1)).toBe(false);
    expect(reachedTarget(c, 12, T0 + 12 * MIN)).toBe(true);
    // Avviso solo nel passaggio (controlli ogni 250 ms).
    expect(crossedTarget(c, 12, T0 + 12 * MIN - 250, T0 + 12 * MIN)).toBe(true);
    expect(crossedTarget(c, 12, T0 + 12 * MIN, T0 + 12 * MIN + 250)).toBe(false);
    // Tornando dopo 5 minuti di background: niente suono in ritardo.
    expect(crossedTarget(c, 12, T0 + 10 * MIN, T0 + 15 * MIN)).toBe(false);
    // Fermo o senza tempo previsto: mai.
    expect(crossedTarget(pauseClock(c, T0 + MIN), 12, T0 + 12 * MIN - 250, T0 + 12 * MIN)).toBe(false);
    expect(reachedTarget(c, 0, T0 + 60 * MIN)).toBe(false);
  });

  it('minuti dal cronometro: arrotondati, almeno 1 se è partito', () => {
    expect(elapsedMinutes(STOPPED, T0)).toBe(0);
    expect(elapsedMinutes(startClock(STOPPED, T0), T0 + 10_000)).toBe(1);
    expect(elapsedMinutes(startClock(STOPPED, T0), T0 + 12.6 * MIN)).toBe(13);
  });
});

describe('esercizio cardio nella sessione', () => {
  it('Fatto ferma il cronometro e riempie i minuti se non scritti; non avvia il recupero', () => {
    let s = startCardioClock(newSession(), CARDIO, T0);
    s = toggleCardioDone(s, CARDIO, T0 + 14 * MIN);
    expect(cardioEntry(s, CARDIO)).toEqual({
      itemIndex: CARDIO,
      minutes: 14,
      distanceKm: null,
      done: true,
      clock: { runningSince: null, elapsedMs: 14 * MIN },
    });
    expect(s.live?.rest ?? null).toBeNull();
    valid(s);
    // Togliere la spunta tiene i valori.
    const undone = toggleCardioDone(s, CARDIO, T0 + 15 * MIN);
    expect(cardioEntry(undone, CARDIO)).toMatchObject({ done: false, minutes: 14 });
  });

  it('minuti e km scritti a mano restano; senza cronometro i minuti restano vuoti', () => {
    let s = setCardioValues(newSession(), CARDIO, { minutes: 20, distanceKm: 3.2 });
    s = startCardioClock(s, CARDIO, T0);
    s = toggleCardioDone(s, CARDIO, T0 + 5 * MIN);
    expect(cardioEntry(s, CARDIO)).toMatchObject({ minutes: 20, distanceKm: 3.2, done: true });
    const plain = toggleCardioDone(newSession(), CARDIO, T0);
    expect(cardioEntry(plain, CARDIO)?.minutes).toBeNull();
    // Su un esercizio di forza non succede niente.
    const strength = setCardioValues(newSession(), 0, { minutes: 5 });
    expect(strength.cardio).toEqual(newSession().cardio);
  });

  it('pausa e ripresa salvate nella sessione (riprendere dopo la chiusura dell’app)', () => {
    let s = startCardioClock(newSession(), CARDIO, T0);
    s = pauseCardioClock(s, CARDIO, T0 + 3 * MIN);
    const reloaded = valid(JSON.parse(JSON.stringify(s)));
    expect(elapsedMs(cardioEntry(reloaded, CARDIO)!.clock, T0 + 30 * MIN)).toBe(3 * MIN);
  });

  it('conteggi, riepilogo, testi', () => {
    let s = newSession();
    expect(cardioCounts(s)).toEqual({ done: 0, total: 1 });
    s = setCardioValues(s, CARDIO, { minutes: 18, distanceKm: 2.9 });
    s = toggleCardioDone(s, CARDIO, T0);
    s = toggleSet(s, 0, 0).session;
    s = finish(s, new Date(T0 + 60 * MIN));
    expect(cardioCounts(s)).toEqual({ done: 1, total: 1 });
    const summary = summarize(s, null, [s]);
    // Serie e volume solo della forza.
    expect(summary.planned).toBe(7);
    expect(summary.done).toBe(1);
    expect(summary.exercises[CARDIO]).toMatchObject({ kind: 'cardio', done: 0, planned: 0, cardio: { plannedMin: 12, minutes: 18, distanceKm: 2.9, done: true } });
    expect(cardioDoneLabel(12, 18, 2.9)).toBe('18′ · 2,9 km');
    expect(cardioDoneLabel(12, null, null)).toBe('12′');
    expect(
      cardioPlanLabel({ minutes: 20, distanceKm: 3, speedKmh: 6.5, inclinePct: 8, level: null }),
    ).toBe('20′ · 3 km · 6,5 km/h · pend. 8 %');
    expect(cardioPlanLabel({ minutes: 15, distanceKm: null, speedKmh: null, inclinePct: null, level: 7 })).toBe('15′ · liv. 7');
  });

  it('ultima volta del cardio: stesso esercizio della sessione precedente', () => {
    let prev = setCardioValues(newSession({ id: 'prev' }), CARDIO, { minutes: 16, distanceKm: 2.5 });
    prev = toggleCardioDone(prev, CARDIO, T0);
    const s = newSession({ previous: prev });
    const table = lastCardioTable(s.snapshot!.items, prev);
    expect(table[CARDIO]).toEqual({ minutes: 16, distanceKm: 2.5, done: true });
    expect(table[0]).toBeNull();
    expect(lastCardioTable(s.snapshot!.items, null)).toEqual([null, null, null, null]);
  });

  it('lo schema rifiuta serie su un cardio e cardio su un esercizio di forza', () => {
    const s = newSession();
    const badSet = { ...s, sets: [...s.sets, { exerciseId: null, itemIndex: CARDIO, setIndex: 0, kg: 0, reps: 1, done: false }] };
    expect(validate(sessionSchema, badSet).ok).toBe(false);
    const badCardio = { ...s, cardio: [{ ...s.cardio[0]!, itemIndex: 0 }] };
    expect(validate(sessionSchema, badCardio).ok).toBe(false);
  });
});

describe('campi minuti e km', () => {
  it('virgola o punto; vuoto = non scritto; testo non valido ignorato', () => {
    expect(parseOptional('2,9', 500)).toBe(2.9);
    expect(parseOptional('18', 600)).toBe(18);
    expect(parseOptional('', 600)).toBeNull();
    expect(parseOptional('  ', 600)).toBeNull();
    expect(parseOptional('abc', 600)).toBeUndefined();
    expect(parseOptional('700', 600)).toBeUndefined();
    expect(optionalInputValue(2.5)).toBe('2,5');
    expect(optionalInputValue(null)).toBe('');
  });
});
