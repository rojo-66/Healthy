// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { workoutFileSchema } from '../../../src/lib/data/schemas/workout-file';
import { compactForLink } from '../../../src/lib/share/canonical';
import { encodeShare } from '../../../src/lib/share/codec';
import { readSharedText } from '../../../src/lib/share/import/detect';
import { QR_MAX_CHARS } from '../../../src/lib/share/limits';
import { decodeQr, type Frame } from '../../../src/lib/share/qr/decode';
import { QR_MARGIN, qrDrawing, qrModules } from '../../../src/lib/share/qr/encode';
import { BASE, typicalWorkoutFile } from './helpers';

/** Immagine RGBA del QR (come la vedrebbe la fotocamera, ma perfetta): `scale` pixel per modulo. */
function render(text: string, scale: number): Frame {
  const modules = qrModules(text);
  const side = modules.length * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const dark = modules[Math.floor(y / scale)]![Math.floor(x / scale)];
      const i = (y * side + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = dark ? 0 : 255;
      data[i + 3] = 255;
    }
  }
  return { data, width: side, height: side };
}

describe('QR: generato in locale e letto dalla funzione di scansione', () => {
  it('il link di una scheda tipica torna identico e si importa', () => {
    const { url } = encodeShare(compactForLink(typicalWorkoutFile(), workoutFileSchema), BASE);
    expect(decodeQr(render(url, 3))).toBe(url);
    const back = readSharedText(url);
    expect(back.ok && back.value.kind).toBe('workout');
  });

  it('alla soglia del QR (1.500 caratteri) è ancora leggibile; versione e lato restano contenuti', () => {
    const url = `${BASE}#import=${'A'.repeat(QR_MAX_CHARS - BASE.length - 8)}`;
    expect(url).toHaveLength(QR_MAX_CHARS);
    const drawing = qrDrawing(url);
    expect(drawing.version).toBeLessThanOrEqual(30);
    expect(drawing.size).toBe(drawing.version * 4 + 17 + 2 * QR_MARGIN);
    expect(decodeQr(render(url, 3))).toBe(url);
  });

  it('il disegno ha il margine chiaro e solo rettangoli', () => {
    const drawing = qrDrawing('https://rojo-66.github.io/Healthy/#import=abc');
    expect(drawing.path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
    const xs = [...drawing.path.matchAll(/M(\d+) (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(Math.min(...xs.map(([x]) => x!))).toBe(QR_MARGIN);
    expect(Math.min(...xs.map(([, y]) => y!))).toBe(QR_MARGIN);
  });

  it('un fotogramma senza QR dà null', () => {
    const side = 64;
    const data = new Uint8ClampedArray(side * side * 4).fill(255);
    expect(decodeQr({ data, width: side, height: side })).toBeNull();
  });
});
