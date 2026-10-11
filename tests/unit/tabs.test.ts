import { describe, expect, it } from 'vitest';
import { indicatorTransform, nextTabIndex } from '../../src/lib/components/tabs';

describe('indicatorTransform', () => {
  it('sposta di una larghezza per tab', () => {
    expect(indicatorTransform(0, 2)).toBe('translateX(0%)');
    expect(indicatorTransform(1, 2)).toBe('translateX(100%)');
    expect(indicatorTransform(2, 3)).toBe('translateX(200%)');
  });

  it('resta dentro i limiti', () => {
    expect(indicatorTransform(5, 3)).toBe('translateX(200%)');
    expect(indicatorTransform(-1, 3)).toBe('translateX(0%)');
    expect(indicatorTransform(0, 0)).toBe('translateX(0%)');
  });
});

describe('nextTabIndex', () => {
  it('frecce con giro', () => {
    expect(nextTabIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextTabIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('Home e Fine', () => {
    expect(nextTabIndex('Home', 2, 3)).toBe(0);
    expect(nextTabIndex('End', 0, 3)).toBe(2);
  });

  it('ignora gli altri tasti', () => {
    expect(nextTabIndex('Enter', 0, 3)).toBeNull();
    expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
  });
});
