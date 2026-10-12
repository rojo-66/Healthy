import { describe, expect, it } from 'vitest';
import { itemSeconds, SET_WORK_SEC, workoutTotals } from '../../../src/lib/workouts/calc/duration';
import { dropIndex, move, shiftFor } from '../../../src/lib/workouts/calc/reorder';
import {
  disablePyramid,
  enablePyramid,
  pyramidDiffers,
  setSetsCount,
  setUniform,
  updateSetDetail,
  type PyramidItem,
} from '../../../src/lib/workouts/calc/sets-detail';
import {
  clampReps,
  clampSets,
  isPresetRest,
  kgStep,
  REPS_MAX,
  restOptions,
  SETS_MAX,
} from '../../../src/lib/workouts/calc/values';
import { itemSummary, kgLabel, nextMeta, originLabel, weekdaysLabel, workoutMeta } from '../../../src/lib/workouts/format';
import { workoutNamed } from './helpers';

describe('durata e contatori', () => {
  it('serie × (recupero + 45 s)', () => {
    expect(SET_WORK_SEC).toBe(45);
    expect(itemSeconds({ sets: 4, restSec: 90 })).toBe(4 * 135);
  });

  it('totali della scheda: esercizi, serie, minuti arrotondati + cardio', () => {
    // 4×(120+45) + 4×(90+45) + 3×(75+45) = 660 + 540 + 360 = 1560 s = 26 min; + 12 di tapis.
    const t = workoutTotals(workoutNamed('Petto + Schiena'));
    expect(t).toEqual({ exercises: 3, sets: 11, strengthMin: 26, cardioMin: 12, totalMin: 38 });
  });

  it('senza cardio e con scheda vuota', () => {
    expect(workoutTotals({ items: [], cardio: null })).toEqual({ exercises: 0, sets: 0, strengthMin: 0, cardioMin: 0, totalMin: 0 });
    // 1 × (60 + 45) = 105 s → 1,75 min → 2.
    expect(workoutTotals({ items: [{ sets: 1, restSec: 60 }], cardio: null }).totalMin).toBe(2);
  });

  it('si ricalcola a ogni modifica (funzione pura)', () => {
    const w = workoutNamed('Gambe');
    const before = workoutTotals(w).sets;
    w.items[0]!.sets += 1;
    expect(workoutTotals(w).sets).toBe(before + 1);
  });

  it('righe di testo delle card', () => {
    const w = workoutNamed('Petto + Schiena');
    expect(workoutMeta(w)).toBe('3 esercizi · 11 serie · ~38’');
    expect(nextMeta(w)).toBe('3 esercizi · 11 serie · ~26’ + 12’ tapis roulant');
    expect(originLabel(w)).toBe('PT · v3');
    expect(originLabel(workoutNamed('Braccia'))).toBe('TUA');
    expect(weekdaysLabel([4, 1])).toBe('LUN · GIO');
    expect(weekdaysLabel([])).toBe('—');
  });
});

describe('regole sui valori', () => {
  it('serie e ripetizioni almeno 1, con un massimo', () => {
    expect(clampSets(0)).toBe(1);
    expect(clampSets(99)).toBe(SETS_MAX);
    expect(clampReps(0)).toBe(1);
    expect(clampReps(500)).toBe(REPS_MAX);
    expect(clampReps(Number.NaN)).toBe(1);
  });

  it('kg: passo 2,5 dal valore attuale (anche scritto a mano fuori griglia), mai sotto 0 né oltre il massimo', () => {
    expect(kgStep(20, 1)).toBe(22.5);
    expect(kgStep(22.5, -1)).toBe(20);
    expect(kgStep(22, 1)).toBe(24.5);
    expect(kgStep(22, -1)).toBe(19.5);
    expect(kgStep(0, -1)).toBe(0);
    expect(kgStep(1, -1)).toBe(0);
    expect(kgStep(57.5, 1)).toBe(60);
    expect(kgStep(499, 1)).toBe(500);
  });

  it('recupero: preset 60/90/120/180, più un valore importato fuori preset', () => {
    expect(isPresetRest(90)).toBe(true);
    expect(isPresetRest(75)).toBe(false);
    expect(restOptions(90)).toEqual([60, 90, 120, 180]);
    expect(restOptions(75)).toEqual([60, 75, 90, 120, 180]);
  });

  it('kg come nel mockup: 0 = "—"', () => {
    expect(kgLabel(57.5)).toBe('57,5');
    expect(kgLabel(0)).toBe('—');
  });
});

describe('serie diverse tra loro (piramidali)', () => {
  const uniform = (): PyramidItem => ({ sets: 3, reps: 10, kg: 60, setsDetail: null, setsDetailMemory: null });

  it('attivando, ogni serie parte dai valori uniformi', () => {
    const p = enablePyramid(uniform());
    expect(p.setsDetail).toEqual([
      { reps: 10, kg: 60 },
      { reps: 10, kg: 60 },
      { reps: 10, kg: 60 },
    ]);
    expect(pyramidDiffers(p)).toBe(false);
  });

  it('modificare la serie 1 aggiorna anche i valori uniformi', () => {
    let p = enablePyramid(uniform());
    p = updateSetDetail(p, 2, { kg: 70, reps: 6 });
    p = updateSetDetail(p, 0, { kg: 50 });
    expect(p.kg).toBe(50);
    expect(pyramidDiffers(p)).toBe(true);
    expect(setUniform(p, { reps: 12 }).setsDetail?.[0]).toEqual({ reps: 12, kg: 50 });
  });

  it('cambiare il numero di serie copia l\'ultima o toglie le ultime', () => {
    let p = updateSetDetail(enablePyramid(uniform()), 2, { kg: 70 });
    p = setSetsCount(p, 5);
    expect(p.setsDetail?.map((s) => s.kg)).toEqual([60, 60, 70, 70, 70]);
    p = setSetsCount(p, 2);
    expect(p.sets).toBe(2);
    expect(p.setsDetail).toHaveLength(2);
    expect(setSetsCount(uniform(), 0).sets).toBe(1);
  });

  it('disattivando tornano uniformi con la serie 1; riattivando si ritrova il dettaglio', () => {
    const p = updateSetDetail(updateSetDetail(enablePyramid(uniform()), 1, { kg: 65 }), 2, { kg: 70, reps: 6 });
    const off = disablePyramid(p);
    expect(off.setsDetail).toBeNull();
    expect(off).toMatchObject({ sets: 3, reps: 10, kg: 60 });
    expect(enablePyramid(off).setsDetail?.map((s) => s.kg)).toEqual([60, 65, 70]);
  });

  it('se nel frattempo cambiano i valori uniformi, riattivando si riparte da quelli', () => {
    const off = disablePyramid(updateSetDetail(enablePyramid(uniform()), 2, { kg: 70 }));
    const changed = setUniform(off, { kg: 80 });
    expect(enablePyramid(changed).setsDetail?.map((s) => s.kg)).toEqual([80, 80, 80]);
  });

  it('riepilogo di una riga piramidale', () => {
    const item = workoutNamed('Petto + Schiena').items[0]!;
    expect(itemSummary(item)).toBe('4 serie · 10–6 rip · 55–65 kg · rec 120 s');
    expect(itemSummary(workoutNamed('Gambe').items[0]!)).toBe('5 × 5 · 80 kg · rec 180 s');
  });
});

describe('riordino', () => {
  it('move sposta un elemento senza modificare l\'originale', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(move(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(move(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(move(list, 1, 9)).toEqual(list);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('dropIndex: si supera un vicino oltre la sua metà', () => {
    const h = [60, 60, 60, 60];
    expect(dropIndex(0, h, 1)).toBe(1);
    expect(dropIndex(29, h, 1)).toBe(1);
    expect(dropIndex(30, h, 1)).toBe(2);
    expect(dropIndex(95, h, 1)).toBe(3);
    expect(dropIndex(500, h, 1)).toBe(3);
    expect(dropIndex(-31, h, 1)).toBe(0);
    expect(dropIndex(-500, h, 1)).toBe(0);
  });

  it('shiftFor: le righe in mezzo scivolano di un posto', () => {
    expect([0, 1, 2, 3].map((i) => shiftFor(i, 0, 2, 60))).toEqual([0, -60, -60, 0]);
    expect([0, 1, 2, 3].map((i) => shiftFor(i, 3, 1, 60))).toEqual([0, 60, 60, 0]);
  });
});
