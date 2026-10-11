import { describe, expect, it } from 'vitest';
import { segmentState } from '../../src/lib/components/segments';

describe('segmentState', () => {
  it('vuoto, parziale, pieno', () => {
    expect(segmentState({ done: 0, total: 4 })).toEqual({ fraction: 0, kind: 'empty' });
    expect(segmentState({ done: 2, total: 4 })).toEqual({ fraction: 0.5, kind: 'partial' });
    expect(segmentState({ done: 4, total: 4 })).toEqual({ fraction: 1, kind: 'full' });
  });

  it('serie oltre il previsto contano come pieno; total 0 è vuoto', () => {
    expect(segmentState({ done: 5, total: 4 }).kind).toBe('full');
    expect(segmentState({ done: 0, total: 0 }).kind).toBe('empty');
  });
});
