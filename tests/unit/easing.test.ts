import { describe, expect, it } from 'vitest';
import { cubicBezier, easeOut, spring } from '../../src/lib/design/transitions';

describe('cubicBezier', () => {
  it('parte da 0 e arriva a 1', () => {
    for (const f of [spring, easeOut]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
    }
  });

  it('la curva lineare è l’identità', () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0.1, 0.25, 0.5, 0.9]) expect(linear(t)).toBeCloseTo(t, 4);
  });

  it('la molla (.2,.9,.3,1.4) supera 1 prima di assestarsi', () => {
    const peak = Math.max(...Array.from({ length: 99 }, (_, i) => spring((i + 1) / 100)));
    expect(peak).toBeGreaterThan(1);
  });

  it('coincide con un valore noto di ease (.25,.1,.25,1)', () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
  });
});
