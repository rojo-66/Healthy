import { describe, expect, it } from 'vitest';
import { msUntilNextMidnight } from '../../src/lib/clock.svelte';
import { fnv1a, FNV_OFFSET } from '../../src/lib/hash';

describe('orologio delle schermate', () => {
  it('a un secondo dopo la prossima mezzanotte locale', () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 12, 23, 59, 30))).toBe(31_000);
    expect(msUntilNextMidnight(new Date(2026, 9, 12, 0, 0, 0))).toBe(24 * 3600_000 + 1000);
    // Dopo il tempo indicato è già il giorno dopo.
    const now = new Date(2026, 9, 18, 13, 0);
    const later = new Date(now.getTime() + msUntilNextMidnight(now));
    expect(later.getDate()).toBe(19);
    expect(later.getHours()).toBe(0);
  });

  it('mai meno di un secondo (niente cicli stretti)', () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 12, 23, 59, 59, 999))).toBeGreaterThanOrEqual(1000);
  });
});

describe('impronta FNV-1a', () => {
  it('valori noti, stabili tra le versioni', () => {
    expect(fnv1a('')).toBe(FNV_OFFSET);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
    expect(fnv1a('2026-10-12')).toBe(fnv1a('2026-10-12'));
    expect(fnv1a('2026-10-12')).not.toBe(fnv1a('2026-10-13'));
  });
});
