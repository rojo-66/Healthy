import { describe, expect, it } from 'vitest';
import { TITLE_MAX_PX, TITLE_MIN_PX, titleFontSize } from '../../src/lib/components/title-fit';

describe('titleFontSize', () => {
  it('un titolo corto usa la dimensione massima', () => {
    expect(titleFontSize('Gambe')).toBe(TITLE_MAX_PX);
    expect(titleFontSize('Petto + Schiena')).toBe(32);
  });

  it('si rimpicciolisce con la lunghezza', () => {
    const medium = titleFontSize('Petto + Schiena + Spalle');
    expect(medium).toBeLessThan(TITLE_MAX_PX);
    expect(medium).toBeGreaterThan(TITLE_MIN_PX);
    expect(titleFontSize('Petto + Schiena + Spalle + Bicipiti')).toBeLessThan(medium);
  });

  it('non scende mai sotto 16 px (poi taglia l’ellissi)', () => {
    expect(titleFontSize('x'.repeat(200))).toBe(TITLE_MIN_PX);
  });

  it('ignora gli spazi ai bordi e regge la stringa vuota', () => {
    expect(titleFontSize('  Gambe  ')).toBe(titleFontSize('Gambe'));
    expect(titleFontSize('')).toBe(TITLE_MAX_PX);
  });

  it('tiene conto della larghezza disponibile', () => {
    const text = 'Petto + Schiena + Spalle';
    expect(titleFontSize(text, 180)).toBeLessThan(titleFontSize(text, 270));
  });
});
