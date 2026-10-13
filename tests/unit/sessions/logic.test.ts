import { describe, expect, it } from 'vitest';
import { segmentState } from '../../../src/lib/components/segments';
import { answeredCount, READINESS_ITEMS, READINESS_MAX, readinessTotal, toReadiness } from '../../../src/lib/sessions/readiness';
import {
  addSet,
  allDone,
  canAddSet,
  finish,
  goToItem,
  noteFor,
  setUserNote,
  toggleAll,
  toggleSet,
  updateSet,
} from '../../../src/lib/sessions/edit';
import { matchItems, sessionItems } from '../../../src/lib/sessions/items';
import { lastTimeTable, prefill } from '../../../src/lib/sessions/last-time';
import {
  bestSet,
  doneSets,
  durationSec,
  missingSets,
  plannedSets,
  segmentsFor,
  setsOf,
  volume,
} from '../../../src/lib/sessions/stats';
import { kgInputValue, parseKg, parseReps } from '../../../src/lib/sessions/input';
import { toggleCardioDone } from '../../../src/lib/sessions/cardio';
import type { StrengthItem } from '../../../src/lib/data/schemas/workouts';
import { check, newSession, READY, sessionWorkout, START, strengthItems, valid } from './helpers';

describe('readiness', () => {
  it('5 voci, 5 = meglio, totale su 25', () => {
    expect(READINESS_ITEMS.map((i) => i.label)).toEqual(['Sonno', 'Umore', 'Energia', 'Stress', 'Affaticamento muscolare']);
    expect(READINESS_ITEMS.find((i) => i.key === 'stress')?.high).toBe('rilassato');
    expect(READINESS_ITEMS.find((i) => i.key === 'soreness')?.high).toBe('nessun dolore');
    expect(READINESS_MAX).toBe(25);
    expect(readinessTotal(READY)).toBe(20);
  });

  it('"Avanti" solo con tutte le risposte valide', () => {
    expect(answeredCount({})).toBe(0);
    expect(toReadiness({})).toBeNull();
    const partial = { sleep: 4, mood: 2 };
    expect(answeredCount(partial)).toBe(2);
    expect(readinessTotal(partial)).toBe(6);
    expect(toReadiness(partial)).toBeNull();
    expect(toReadiness({ ...READY })).toEqual(READY);
    expect(toReadiness({ ...READY, energy: 6 })).toBeNull();
    expect(toReadiness({ ...READY, energy: 2.5 })).toBeNull();
    expect(answeredCount({ ...READY, energy: 0 })).toBe(4);
  });
});

describe('nuova sessione', () => {
  it('copia della scheda, serie del piano precompilate (piramidale), valida per il database', () => {
    const s = valid(newSession());
    expect(s.workoutName).toBe('Spinta finta');
    expect(s.workoutVersion).toBe(2);
    expect(s.startedAt).toBe(START.toISOString());
    expect(s.endedAt).toBeNull();
    expect(s.live).toEqual({ itemIndex: 0, rest: null });
    expect(s.snapshot?.items).toHaveLength(4);
    // 2a: il cardio è l'ultimo esercizio, con la sua voce vuota (niente serie).
    expect(s.snapshot?.items[3]).toMatchObject({ kind: 'cardio', name: 'Tapis roulant · corsa', minutes: 12 });
    expect(s.cardio).toEqual([{ itemIndex: 3, minutes: null, distanceKm: null, done: false, clock: { runningSince: null, elapsedMs: 0 } }]);
    expect(setsOf(s, 3)).toEqual([]);
    expect(setsOf(s, 0).map((x) => [x.kg, x.reps, x.done])).toEqual([
      [55, 10, false],
      [60, 8, false],
      [65, 6, false],
    ]);
    expect(setsOf(s, 2).map((x) => [x.exerciseId, x.kg, x.reps])).toEqual([
      [null, 15, 12],
      [null, 15, 12],
    ]);
  });

  it('la copia non cambia se la scheda viene modificata dopo', () => {
    const workout = sessionWorkout();
    const s = newSession({ workout });
    const first = workout.items[0] as StrengthItem;
    first.name = 'Cambiato';
    first.muscles.push('Spalle');
    expect(s.snapshot?.items[0]?.name).toBe('Panca piana con bilanciere');
    expect((s.snapshot?.items[0] as StrengthItem).muscles).toEqual(['Petto', 'Tricipiti']);
  });
});

describe('ultima volta e precompilazione', () => {
  function previousSession() {
    let prev = newSession({ id: 'prev', now: new Date(2026, 9, 8, 18, 0) });
    prev = updateSet(prev, 0, 0, { kg: 57.5, reps: 10 });
    prev = updateSet(prev, 1, 1, { kg: 52.5, reps: 9 });
    prev = check(prev, [0, 0], [0, 1], [1, 0], [1, 1], [2, 0]);
    return finish(prev, new Date(2026, 9, 8, 19, 0));
  }

  it('serie corrispondenti per esercizio e numero di serie', () => {
    const prev = previousSession();
    const table = lastTimeTable(sessionWorkout().items, prev);
    expect(table[0]?.[0]).toEqual({ kg: 57.5, reps: 10, done: true });
    expect(table[0]?.[2]).toEqual({ kg: 65, reps: 6, done: false });
    expect(table[1]?.[1]).toEqual({ kg: 52.5, reps: 9, done: true });
    expect(table[2]?.[1]?.done).toBe(false);
  });

  it('precompila con l’ultima volta se fatta, altrimenti con il piano', () => {
    const s = newSession({ previous: previousSession() });
    expect(setsOf(s, 0).map((x) => [x.kg, x.reps])).toEqual([
      [57.5, 10],
      [60, 8],
      [65, 6],
    ]);
    expect(setsOf(s, 1).map((x) => [x.kg, x.reps])).toEqual([
      [50, 10],
      [52.5, 9],
    ]);
  });

  it('scheda riordinata: si abbinano per esercizio (id o nome) e occorrenza', () => {
    const prev = previousSession();
    const workout = sessionWorkout();
    const items = strengthItems(workout).reverse();
    items[0]!.name = 'croci  AI cavi'; // stesso esercizio senza id: confronto per nome normalizzato
    const table = lastTimeTable(items, prev);
    expect(table[2]?.[0]).toEqual({ kg: 57.5, reps: 10, done: true });
    expect(table[1]?.[1]).toEqual({ kg: 52.5, reps: 9, done: true });
    expect(table[0]?.[0]?.done).toBe(true);
  });

  it('stesso esercizio due volte: il secondo con il secondo', () => {
    const a = { exerciseId: 'x', name: 'X' };
    const b = { exerciseId: null, name: 'Y' };
    expect(matchItems([a, b, a], [a, a, b])).toEqual([0, 2, 1]);
    expect(matchItems([a, a, a], [a])).toEqual([0, null, null]);
    expect(matchItems([{ exerciseId: null, name: '  ' }], [{ exerciseId: null, name: '' }])).toEqual([null]);
  });

  it('nessuna sessione precedente o sessione senza copia della scheda', () => {
    expect(lastTimeTable(sessionWorkout().items, null)).toEqual([[], [], [], []]);
    const legacy = { snapshot: null, sets: [{ exerciseId: 'fx-wide-grip-lat-pulldown', itemIndex: 0, setIndex: 0, kg: 40, reps: 12, done: true }] };
    const table = lastTimeTable(sessionWorkout().items, legacy);
    expect(table[1]?.[0]).toEqual({ kg: 40, reps: 12, done: true });
    expect(table[2]).toEqual([]);
    expect(sessionItems(legacy)[0]).toMatchObject({ name: 'Esercizio 1', sets: 1 });
  });

  it('prefill: piano uniforme e piramidale', () => {
    const [panca, lat] = strengthItems();
    expect(prefill(lat!, 1)).toEqual({ kg: 50, reps: 10 });
    expect(prefill(panca!, 2)).toEqual({ kg: 65, reps: 6 });
    expect(prefill(panca!, 2, { kg: 70, reps: 5, done: true })).toEqual({ kg: 70, reps: 5 });
    expect(prefill(panca!, 2, { kg: 70, reps: 5, done: false })).toEqual({ kg: 65, reps: 6 });
  });
});

describe('modifiche', () => {
  it('spunta: avvia il recupero solo quando una serie diventa fatta', () => {
    const s = newSession();
    const on = toggleSet(s, 1, 0);
    expect(on.startRest).toBe(true);
    expect(setsOf(on.session, 1)[0]?.done).toBe(true);
    const off = toggleSet(on.session, 1, 0);
    expect(off.startRest).toBe(false);
    expect(setsOf(off.session, 1)[0]?.done).toBe(false);
    expect(setsOf(s, 1)[0]?.done).toBe(false); // l'originale non cambia
  });

  it('doppia spunta: segna tutte, poi le toglie tutte', () => {
    let s = check(newSession(), [0, 1]);
    const all = toggleAll(s, 0);
    expect(all.startRest).toBe(true);
    expect(allDone(all.session, 0)).toBe(true);
    expect(allDone(all.session, 1)).toBe(false);
    const none = toggleAll(all.session, 0);
    expect(none.startRest).toBe(false);
    expect(setsOf(none.session, 0).some((x) => x.done)).toBe(false);
    s = none.session;
    expect(doneSets(s)).toBe(0);
  });

  it('aggiungi serie: copia l’ultima, fino a 20', () => {
    let s = updateSet(newSession(), 1, 1, { kg: 55, reps: 8 });
    s = addSet(s, 1);
    expect(setsOf(s, 1)).toHaveLength(3);
    expect(setsOf(s, 1)[2]).toMatchObject({ setIndex: 2, kg: 55, reps: 8, done: false, exerciseId: 'fx-wide-grip-lat-pulldown' });
    for (let i = 0; i < 30; i++) s = addSet(s, 1);
    expect(setsOf(s, 1)).toHaveLength(20);
    expect(canAddSet(s, 1)).toBe(false);
    valid(s);
  });

  it('note per il PT, esercizio corrente, cardio, fine', () => {
    let s = setUserNote(newSession(), 2, 'Spalla un po’ rigida');
    expect(noteFor(s, 2)).toBe('Spalla un po’ rigida');
    expect(s.userNotes[0]).toMatchObject({ itemIndex: 2, exerciseId: null });
    s = setUserNote(s, 2, '   ');
    expect(s.userNotes).toEqual([]);

    expect(goToItem(s, 2).live?.itemIndex).toBe(2);
    expect(goToItem(s, 9).live?.itemIndex).toBe(3);
    expect(goToItem(s, -1).live?.itemIndex).toBe(0);
    // Nota anche sul cardio.
    expect(noteFor(setUserNote(s, 3, 'Fiato corto'), 3)).toBe('Fiato corto');

    const ended = finish(s, new Date(START.getTime() + 3_600_000));
    expect(ended.live).toBeNull();
    expect(durationSec(ended)).toBe(3600);
    // Orologio indietro: la fine non precede mai l'inizio.
    expect(finish(s, new Date(START.getTime() - 5000)).endedAt).toBe(s.startedAt);
    valid(ended);
  });
});

describe('numeri della sessione', () => {
  it('volume, serie fatte/previste, saltate, serie aggiunte', () => {
    let s = newSession();
    expect(plannedSets(s)).toBe(7);
    s = check(s, [0, 0], [0, 1], [1, 0]);
    // 55×10 + 60×8 + 50×10
    expect(volume(s.sets)).toBe(1530);
    expect(doneSets(s)).toBe(3);
    expect(missingSets(s)).toBe(4);
    expect(missingSets(s, 0)).toBe(1);

    s = addSet(s, 1); // aggiunta non spuntata: non è "saltata"
    expect(missingSets(s)).toBe(4);
    s = check(s, [1, 1], [1, 2], [0, 2], [2, 0], [2, 1]);
    expect(doneSets(s)).toBe(8);
    expect(plannedSets(s)).toBe(7);
    expect(missingSets(s)).toBe(0);
    expect(volume([{ kg: 0, reps: 15, done: true }])).toBe(0);
    expect(volume([{ kg: 22.5, reps: 3, done: true }, { kg: 100, reps: 3, done: false }])).toBe(67.5);
  });

  it('serie migliore: più kg, a parità più ripetizioni; corpo libero = più ripetizioni', () => {
    expect(bestSet([])).toBeNull();
    expect(bestSet([{ kg: 60, reps: 8, done: false }])).toBeNull();
    expect(
      bestSet([
        { kg: 60, reps: 8, done: true },
        { kg: 62.5, reps: 6, done: true },
        { kg: 62.5, reps: 7, done: true },
        { kg: 70, reps: 7, done: false },
      ]),
    ).toEqual({ kg: 62.5, reps: 7, done: true });
    expect(bestSet([{ kg: 0, reps: 12, done: true }, { kg: 0, reps: 15, done: true }])?.reps).toBe(15);
  });

  it('durata di una sessione in corso fino ad adesso', () => {
    const s = newSession();
    expect(durationSec(s, START.getTime() + 125_900)).toBe(125);
  });
});

describe('barra a segmenti', () => {
  it('vuoto, parziale, pieno; le serie aggiunte non superano il pieno', () => {
    let s = check(newSession(), [0, 0], [1, 0], [1, 1]);
    s = addSet(s, 1);
    s = check(s, [1, 2]);
    const segs = segmentsFor(s);
    expect(segs).toEqual([
      { done: 1, total: 3 },
      { done: 2, total: 2 },
      { done: 0, total: 2 },
      { done: 0, total: 1 },
    ]);
    expect(segs.map((x) => segmentState(x).kind)).toEqual(['partial', 'full', 'empty', 'empty']);
    // 2a: il cardio è un segmento pieno quando è fatto.
    expect(segmentsFor(toggleCardioDone(s, 3, START.getTime()))[3]).toEqual({ done: 1, total: 1 });
    expect(segmentState(segs[0]!).fraction).toBeCloseTo(1 / 3);
  });
});

describe('campi kg e ripetizioni', () => {
  it('kg con virgola o punto, due decimali, limiti', () => {
    expect(parseKg('57,5')).toBe(57.5);
    expect(parseKg(' 57.5 ')).toBe(57.5);
    expect(parseKg('60')).toBe(60);
    expect(parseKg('60,')).toBe(60);
    expect(parseKg(',5')).toBe(0.5);
    expect(parseKg('22,555')).toBe(22.56);
    expect(parseKg('0')).toBe(0);
    for (const bad of ['', 'abc', '-5', '1001', '5,5,5', '1e3', '５']) expect(parseKg(bad)).toBeNull();
  });

  it('ripetizioni intere 0–1000', () => {
    expect(parseReps('10')).toBe(10);
    expect(parseReps(' 0 ')).toBe(0);
    for (const bad of ['', '8,5', '-1', '1001', 'dieci']) expect(parseReps(bad)).toBeNull();
  });

  it('valore mostrato nel campo kg', () => {
    expect(kgInputValue(57.5)).toBe('57,5');
    expect(kgInputValue(1000)).toBe('1000');
    expect(kgInputValue(0)).toBe('0');
  });
});
