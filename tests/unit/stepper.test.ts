import { describe, expect, it } from 'vitest';
import { canStep, clamp, formatNumber, stepValue } from '../../src/lib/components/stepper';

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
