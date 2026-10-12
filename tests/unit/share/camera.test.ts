// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { cameraErrorMessage, scanSize, stopStream } from '../../../src/lib/share/qr/camera';

describe('fotocamera per la scansione', () => {
  it('permesso negato, nessuna fotocamera, occupata, altro: sempre con l’alternativa', () => {
    expect(cameraErrorMessage({ name: 'NotAllowedError' })).toMatch(/Hai negato.*incolla il link o scegli il file/);
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toMatch(/Non trovo una fotocamera/);
    expect(cameraErrorMessage({ name: 'NotReadableError' })).toMatch(/occupata/);
    expect(cameraErrorMessage(new Error('boh'))).toMatch(/incolla il link/);
    expect(cameraErrorMessage(null)).toMatch(/incolla il link/);
  });

  it('spegne tutte le tracce', () => {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    stopStream({ getTracks: () => tracks as unknown as MediaStreamTrack[] });
    expect(tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
    expect(() => stopStream(null)).not.toThrow();
  });

  it('riduce il fotogramma mantenendo le proporzioni', () => {
    expect(scanSize(1280, 720)).toEqual({ width: 960, height: 540 });
    expect(scanSize(640, 480)).toEqual({ width: 640, height: 480 });
    expect(scanSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});
