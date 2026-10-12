/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../src/lib/design/contrast';

// Legge i colori direttamente da tokens.css, così il test segue ogni modifica dei token.
// (Vitest non elabora il CSS, quindi niente import `?raw`.)
const css = readFileSync(resolve(process.cwd(), 'src/lib/design/tokens.css'), 'utf8');

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
  if (!m?.[1]) throw new Error(`Token --${name} non trovato`);
  return m[1];
}

const tones = ['training', 'food', 'progress', 'tip'];

describe('contrasto dei token (≥ 4.5:1)', () => {
  const pairs: [string, string][] = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['text-2', 'surface'],
    ['muted', 'bg'],
    ['muted', 'surface'],
    ...tones.map((t): [string, string] => [t, 'surface']),
    // Testo scuro (--bg) sopra i pulsanti pieni di sezione
    ...tones.map((t): [string, string] => ['bg', t]),
  ];

  it.each(pairs)('--%s su --%s', (fg, bg) => {
    expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('calcolo di riferimento: bianco su nero = 21', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });
});

describe('Profilo (M7): variazioni colorate e suggerimenti nei campi (≥ 4.5:1)', () => {
  // Ciano = direzione giusta, giallo = da tenere d'occhio, grigio = neutra; card su --surface, campi su --bg.
  const pairs: [string, string][] = [
    ['progress', 'surface'],
    ['tip', 'surface'],
    ['muted', 'surface'],
    ['progress', 'bg'],
    ['tip', 'bg'],
    ['muted', 'bg'],
  ];

  it.each(pairs)('--%s su --%s', (fg, bg) => {
    expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
