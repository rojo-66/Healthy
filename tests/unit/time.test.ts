import { describe, expect, it } from 'vitest';
import { formatClock } from '../../src/lib/components/time';

describe('formatClock', () => {
  it('minuti e secondi', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(74)).toBe('01:14');
    expect(formatClock(1934)).toBe('32:14');
  });

  it('ore oltre i 60 minuti', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('valori negativi, decimali o non numerici', () => {
    expect(formatClock(-3)).toBe('00:00');
    expect(formatClock(9.9)).toBe('00:09');
    expect(formatClock(Number.NaN)).toBe('00:00');
  });
});
