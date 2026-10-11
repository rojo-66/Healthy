import { describe, expect, it } from 'vitest';
import { fitLabelSize, ringGeometry } from '../../src/lib/components/ring';

describe('ringGeometry', () => {
  it('calcola raggio e circonferenza (anello da 96 px dei mockup: r = 40)', () => {
    const g = ringGeometry(96, 16, 0, 1);
    expect(g.r).toBe(40);
    expect(g.circumference).toBeCloseTo(251.33, 1);
  });

  it('dashoffset: pieno a 0, vuoto alla circonferenza', () => {
    const c = ringGeometry(124, 12, 0, 100).circumference;
    expect(ringGeometry(124, 12, 100, 100).dashoffset).toBe(0);
    expect(ringGeometry(124, 12, 0, 100).dashoffset).toBeCloseTo(c, 1);
    expect(ringGeometry(124, 12, 50, 100).dashoffset).toBeCloseTo(c / 2, 1);
  });

  it('valori fuori scala, max nullo o NaN non rompono l’anello', () => {
    expect(ringGeometry(100, 10, 250, 100).fraction).toBe(1);
    expect(ringGeometry(100, 10, -5, 100).fraction).toBe(0);
    expect(ringGeometry(100, 10, 5, 0).fraction).toBe(0);
    expect(ringGeometry(100, 10, Number.NaN, 100).fraction).toBe(0);
  });

  it('il quadrato per il testo sta dentro il foro', () => {
    const g = ringGeometry(124, 12, 1, 2);
    const hole = g.r - 6;
    // La diagonale del quadrato non supera il diametro del foro.
    expect(g.innerBox * Math.SQRT2).toBeLessThanOrEqual(hole * 2);
  });
});

describe('fitLabelSize', () => {
  it('usa la dimensione base se il testo ci sta', () => {
    expect(fitLabelSize('577', 70, 24)).toBe(24);
  });

  it('rimpicciolisce i testi lunghi perché non escano dall’anello', () => {
    const size = fitLabelSize('12.345', 70, 24);
    expect(size).toBeLessThan(24);
    expect(size * 0.62 * '12.345'.length).toBeLessThanOrEqual(70);
  });

  it('non scende sotto il minimo', () => {
    expect(fitLabelSize('x'.repeat(100), 40, 24)).toBe(8);
  });
});
