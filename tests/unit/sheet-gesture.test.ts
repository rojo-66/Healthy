import { describe, expect, it } from 'vitest';
import { dragOffset, shouldDismiss } from '../../src/lib/components/sheet-gesture';

describe('dragOffset', () => {
  it('segue il dito verso il basso, non sale oltre la posizione aperta', () => {
    expect(dragOffset(40)).toBe(40);
    expect(dragOffset(-30)).toBe(0);
  });
});

describe('shouldDismiss', () => {
  it('chiude oltre un quarto dell’altezza', () => {
    expect(shouldDismiss(120, 0, 400)).toBe(true);
    expect(shouldDismiss(80, 0.1, 400)).toBe(false);
  });

  it('chiude con un colpo veloce anche se breve', () => {
    expect(shouldDismiss(40, 0.8, 400)).toBe(true);
    expect(shouldDismiss(10, 0.8, 400)).toBe(false);
  });

  it('non chiude trascinando verso l’alto', () => {
    expect(shouldDismiss(-100, 2, 400)).toBe(false);
  });
});
