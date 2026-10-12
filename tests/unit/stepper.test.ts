import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canStep,
  clamp,
  createRepeater,
  formatNumber,
  parseNumber,
  readTyped,
  repeatDelay,
  REPEAT_HOLD_MS,
  stepValue,
  typedMessage,
} from '../../src/lib/components/stepper';

const KG = { min: 0, max: 300, step: 2.5 };
const SETS = { min: 1, max: 10, step: 1 };

describe('stepValue', () => {
  it('somma e sottrae il passo', () => {
    expect(stepValue(4, 1, SETS)).toBe(5);
    expect(stepValue(4, -1, SETS)).toBe(3);
  });

  it('resta tra min e max', () => {
    expect(stepValue(10, 1, SETS)).toBe(10);
    expect(stepValue(1, -1, SETS)).toBe(1);
    expect(stepValue(1, -1, KG)).toBe(0);
  });

  it('niente errori di virgola mobile con passo 2,5 e 0,1', () => {
    expect(stepValue(70, 1, KG)).toBe(72.5);
    let v = 0;
    for (let i = 0; i < 3; i++) v = stepValue(v, 1, { min: 0, max: 10, step: 0.1 });
    expect(v).toBe(0.3);
  });
});

describe('canStep', () => {
  it('disattiva − al minimo e + al massimo', () => {
    expect(canStep(1, -1, SETS)).toBe(false);
    expect(canStep(10, 1, SETS)).toBe(false);
    expect(canStep(5, 1, SETS)).toBe(true);
    expect(canStep(5, -1, SETS)).toBe(true);
  });
});

describe('clamp e formatNumber', () => {
  it('clamp', () => {
    expect(clamp(-1, 0, 5)).toBe(0);
    expect(clamp(9, 0, 5)).toBe(5);
    expect(clamp(3, 0, 5)).toBe(3);
  });

  it('virgola italiana', () => {
    expect(formatNumber(72.5)).toBe('72,5');
    expect(formatNumber(70)).toBe('70');
  });
});

describe('numero scritto a mano', () => {
  const KG_TYPED = { min: 0, max: 500, integer: false, confirmAbove: 250 };

  it('accetta virgola, punto e spazi; rifiuta testo e vuoto', () => {
    expect(parseNumber('22,5')).toBe(22.5);
    expect(parseNumber('22.5')).toBe(22.5);
    expect(parseNumber(' 22 ')).toBe(22);
    expect(parseNumber(',5')).toBe(0.5);
    expect(parseNumber('22,')).toBe(22);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('2,5,5')).toBeNull();
    expect(parseNumber('1e3')).toBeNull();
  });

  it('il valore scritto non viene agganciato al passo', () => {
    expect(readTyped('22', KG_TYPED)).toEqual({ kind: 'ok', value: 22 });
    expect(readTyped('22,25', KG_TYPED)).toEqual({ kind: 'ok', value: 22.25 });
    expect(readTyped('22,333', KG_TYPED)).toEqual({ kind: 'ok', value: 22.33 });
  });

  it('fuori limite e non numeri: avviso, il valore non cambia', () => {
    expect(readTyped('501', KG_TYPED)).toEqual({ kind: 'out-of-range' });
    expect(readTyped('-1', KG_TYPED)).toEqual({ kind: 'out-of-range' });
    expect(readTyped('kg', KG_TYPED)).toEqual({ kind: 'invalid' });
    expect(typedMessage({ kind: 'out-of-range' }, { min: 0, max: 500, unit: 'kg' })).toBe('Valore tra 0 e 500 kg.');
    expect(typedMessage({ kind: 'invalid' }, { min: 0, max: 500 })).toBe('Scrivi un numero.');
  });

  it('valori sospetti chiedono conferma', () => {
    expect(readTyped('250', KG_TYPED)).toEqual({ kind: 'ok', value: 250 });
    expect(readTyped('300', KG_TYPED)).toEqual({ kind: 'confirm', value: 300 });
  });

  it('serie e ripetizioni: solo interi', () => {
    expect(readTyped('10,5', { ...SETS, integer: true })).toEqual({ kind: 'not-integer' });
    expect(readTyped('8', { ...SETS, integer: true })).toEqual({ kind: 'ok', value: 8 });
  });

  it('dopo un valore libero +/− proseguono col passo', () => {
    expect(stepValue(22, 1, { min: 0, max: 500, step: 2.5 })).toBe(24.5);
    expect(stepValue(22, -1, { min: 0, max: 500, step: 2.5 })).toBe(19.5);
    expect(stepValue(22.25, 1, { min: 0, max: 500, step: 2.5 })).toBe(24.75);
  });
});

describe('pressione lunga', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('il ritmo accelera fino a un minimo', () => {
    expect(repeatDelay(0)).toBe(REPEAT_HOLD_MS);
    expect(repeatDelay(1)).toBe(180);
    expect(repeatDelay(2)).toBeLessThan(repeatDelay(1));
    expect(repeatDelay(50)).toBe(40);
  });

  it('un tocco breve non ripete; tenendo premuto i passi aumentano sempre più in fretta', () => {
    let v = 0;
    const r = createRepeater(() => {
      v += 1;
      return true;
    });
    r.start();
    vi.advanceTimersByTime(REPEAT_HOLD_MS - 1);
    expect(r.stop()).toBe(false);
    expect(v).toBe(0);

    r.start();
    vi.advanceTimersByTime(REPEAT_HOLD_MS);
    expect(v).toBe(1);
    vi.advanceTimersByTime(1000);
    const afterOneSecond = v;
    vi.advanceTimersByTime(1000);
    // Nel secondo successivo i passi sono di più (ritmo più veloce).
    expect(v - afterOneSecond).toBeGreaterThan(afterOneSecond - 1);
    expect(r.stop()).toBe(true);
    const stopped = v;
    vi.advanceTimersByTime(2000);
    expect(v).toBe(stopped);
  });

  it('si ferma da solo al limite', () => {
    let v = 8;
    const r = createRepeater(() => {
      v = stepValue(v, 1, SETS);
      return canStep(v, 1, SETS);
    });
    r.start();
    vi.advanceTimersByTime(5000);
    expect(v).toBe(10);
    expect(r.stop()).toBe(true);
  });
});
