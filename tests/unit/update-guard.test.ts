import { describe, expect, it } from 'vitest';
import { updateDeferred } from '../../src/lib/pwa/update-guard';

const calm = { dialogOpen: false, keyboardOpen: false };

describe('avviso di nuova versione', () => {
  it('compare sulle schermate normali', () => {
    for (const path of ['/', '/allena', '/dieta', '/progressi', '/profilo', '/allena/vedi']) {
      expect(updateDeferred({ path, ...calm })).toBe(false);
    }
  });

  it('aspetta durante la sessione e con un modulo aperto', () => {
    for (const path of ['/sessione/live', '/sessione/readiness', '/allena/editor', '/profilo/misura', '/dieta/completa', '/importa']) {
      expect(updateDeferred({ path, ...calm })).toBe(true);
    }
  });

  it('aspetta con un pannello aperto o la tastiera aperta', () => {
    expect(updateDeferred({ path: '/', dialogOpen: true, keyboardOpen: false })).toBe(true);
    expect(updateDeferred({ path: '/', dialogOpen: false, keyboardOpen: true })).toBe(true);
  });
});
