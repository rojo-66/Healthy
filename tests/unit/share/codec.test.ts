// @vitest-environment node
import * as lzModule from 'lz-string';
import { describe, expect, it } from 'vitest';
import { dietFileSchema } from '../../../src/lib/data/schemas/diet-file';
import { workoutFileSchema } from '../../../src/lib/data/schemas/workout-file';
import { shareAvailability } from '../../../src/lib/share/availability';
import { compactForLink } from '../../../src/lib/share/canonical';
import { decodePayload, encodeShare, TRUNCATED_MESSAGE } from '../../../src/lib/share/codec';
import { readSharedPayload, readSharedText } from '../../../src/lib/share/import/detect';
import { LINK_MAX_CHARS, PAYLOAD_MAX_CHARS, QR_MAX_CHARS } from '../../../src/lib/share/limits';
import { decompressUriSafe } from '../../../src/lib/share/lz-decompress';
import { BASE, bigWorkoutFile, dietFile, smallDietFile, typicalWorkoutFile } from './helpers';

const lz = (lzModule as unknown as { default?: typeof lzModule }).default ?? lzModule;

function errorsOf(result: { ok: boolean; errors?: string[] }): string[] {
  expect(result.ok).toBe(false);
  return result.errors ?? [];
}

describe('decompressore con tetto (port di lz-string)', () => {
  it('stesso risultato di lz-string su testi vari (accenti, emoji, ripetizioni, vuoto)', () => {
    const samples = [
      '',
      'a',
      'Panca piana · 4 × 8 · 72,5 kg',
      'àèìòù €£ 💪🏋️ «virgolette» — trattino',
      'ab'.repeat(5000),
      JSON.stringify(typicalWorkoutFile()),
    ];
    for (let i = 0; i < 50; i++) {
      samples.push(Array.from({ length: 1 + i * 37 }, (_, k) => String.fromCharCode(32 + ((k * 7919 + i) % 400))).join(''));
    }
    for (const text of samples) {
      const compressed = lz.compressToEncodedURIComponent(text);
      const out = decompressUriSafe(compressed, 10_000_000);
      expect(out).toEqual({ ok: true, text });
      expect(lz.decompressFromEncodedURIComponent(compressed)).toBe(text);
    }
  });

  it('si ferma appena l’uscita supera il tetto ("bomba" di espansione)', () => {
    // Un testo ripetitivo si comprime moltissimo: pochi caratteri diventano milioni.
    const bomb = lz.compressToEncodedURIComponent('x'.repeat(1_200_000));
    expect(bomb.length).toBeLessThan(PAYLOAD_MAX_CHARS);
    const started = performance.now();
    expect(decompressUriSafe(bomb, 100_000)).toEqual({ ok: false, reason: 'too-big' });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('payload tagliato o con caratteri estranei', () => {
    const payload = lz.compressToEncodedURIComponent(JSON.stringify(typicalWorkoutFile()));
    expect(decompressUriSafe(payload.slice(0, payload.length - 40), 1_000_000).ok).toBe(false);
    expect(decompressUriSafe(payload.slice(0, 10), 1_000_000).ok).toBe(false);
    expect(decompressUriSafe('abc<script>', 1_000_000)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('link: codifica e decodifica', () => {
  it('round-trip di una scheda (forma completa e compatta)', () => {
    const file = typicalWorkoutFile();
    for (const content of [file, compactForLink(file, workoutFileSchema)]) {
      const { url, payload } = encodeShare(content, BASE);
      expect(url).toBe(`${BASE}#import=${payload}`);
      const back = readSharedText(url);
      expect(back).toEqual({ ok: true, value: { kind: 'workout', file } });
    }
  });

  it('round-trip di una dieta (piccola: quelle vere superano il limite del link)', () => {
    const file = smallDietFile();
    const { payload } = encodeShare(compactForLink(file, dietFileSchema), BASE);
    const back = readSharedPayload(payload);
    expect(back.ok && back.value.kind === 'diet' ? back.value.imp.file : null).toEqual(file);
  });

  it('la forma compatta toglie i campi vuoti e si accorcia', () => {
    const file = typicalWorkoutFile();
    const compact = compactForLink(file, workoutFileSchema) as Record<string, unknown>;
    expect(JSON.stringify(compact)).not.toContain('"setsDetail":null');
    expect(JSON.stringify(compact)).not.toContain('"note":""');
    expect(encodeShare(compact, BASE).payload.length).toBeLessThan(encodeShare(file, BASE).payload.length);
  });

  it('una dieta vera è troppo lunga anche come codice incollato: si chiede il file', () => {
    const { payload } = encodeShare(dietFile(), BASE);
    expect(errorsOf(readSharedPayload(payload))[0]).toMatch(/troppo lungo per un link di Healthy.*Chiedi il file/);
  });

  it('rifiuti con messaggi chiari, senza mai lanciare', () => {
    const { payload } = encodeShare(typicalWorkoutFile(), BASE);
    expect(errorsOf(decodePayload(payload.slice(0, Math.floor(payload.length / 2))))).toEqual([TRUNCATED_MESSAGE]);
    expect(errorsOf(decodePayload('A'.repeat(PAYLOAD_MAX_CHARS + 1)))[0]).toMatch(/troppo lungo/);
    expect(errorsOf(decodePayload('abc%def'))[0]).toMatch(/caratteri non validi/);
    expect(errorsOf(decodePayload('   '))[0]).toMatch(/non contiene dati/);
    const bomb = lz.compressToEncodedURIComponent('x'.repeat(1_200_000));
    expect(errorsOf(decodePayload(bomb))[0]).toMatch(/troppo grande/);
    // Testo compresso che non è JSON.
    expect(errorsOf(decodePayload(lz.compressToEncodedURIComponent('{"app": "healthy-app", ')))).toEqual([TRUNCATED_MESSAGE]);
    const proto = lz.compressToEncodedURIComponent('{"app":"healthy-app","__proto__":{"x":1}}');
    expect(errorsOf(decodePayload(proto))[0]).toMatch(/__proto__/);
  });
});

describe('soglie (link e QR)', () => {
  function urlLength(content: unknown): number {
    return encodeShare(content, BASE).url.length;
  }

  it('una scheda tipica (6 esercizi con note) va bene per link e QR', () => {
    const chars = urlLength(compactForLink(typicalWorkoutFile(), workoutFileSchema));
    // Misurato: ≈ 1.280 caratteri con l'indirizzo di GitHub Pages.
    expect(chars).toBeGreaterThan(900);
    expect(chars).toBeLessThanOrEqual(QR_MAX_CHARS);
    expect(shareAvailability(chars)).toMatchObject({ link: { ok: true }, qr: { ok: true } });
  });

  it('una scheda lunga (30 esercizi con note) supera il QR ma resta un link', () => {
    const chars = urlLength(compactForLink(bigWorkoutFile(30), workoutFileSchema));
    expect(chars).toBeGreaterThan(QR_MAX_CHARS);
    expect(chars).toBeLessThanOrEqual(LINK_MAX_CHARS);
    const a = shareAvailability(chars);
    expect(a.link.ok).toBe(true);
    expect(a.qr).toEqual({ ok: false, reason: expect.stringMatching(/Troppo lungo per un QR leggibile.*usa il link o il file/) });
  });

  it('una dieta è "solo file", con il motivo', () => {
    const chars = urlLength(compactForLink(dietFile(), dietFileSchema));
    expect(chars).toBeGreaterThan(LINK_MAX_CHARS);
    const a = shareAvailability(chars);
    expect(a.link).toEqual({ ok: false, reason: expect.stringMatching(/^Troppo lungo per un link .*Usa il file\.$/) });
    expect(a.qr).toEqual({ ok: false, reason: 'Troppo lungo anche per il QR: usa il file.' });
  });

  it('i limiti sono coerenti tra loro', () => {
    expect(QR_MAX_CHARS).toBeLessThan(LINK_MAX_CHARS);
    expect(LINK_MAX_CHARS).toBeLessThan(PAYLOAD_MAX_CHARS);
    expect(shareAvailability(LINK_MAX_CHARS).link.ok).toBe(true);
    expect(shareAvailability(LINK_MAX_CHARS + 1).link.ok).toBe(false);
    expect(shareAvailability(QR_MAX_CHARS).qr.ok).toBe(true);
    expect(shareAvailability(QR_MAX_CHARS + 1).qr.ok).toBe(false);
  });
});
