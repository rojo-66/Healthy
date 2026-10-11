import { describe, expect, it, vi } from 'vitest';
import { createBeeper } from '../../../src/lib/sessions/audio';
import { createKeepAwake, type WakeLockEnv } from '../../../src/lib/sessions/wake-lock';

function fakeAudio(state: AudioContextState = 'running') {
  const started: number[] = [];
  class FakeContext {
    state = state;
    currentTime = 10;
    destination = {};
    resume = vi.fn(async () => {
      this.state = 'running';
    });
    createBuffer = () => ({});
    createBufferSource = () => ({ buffer: null, connect: () => undefined, start: () => undefined });
    createGain = () => ({
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: (n: unknown) => n,
    });
    createOscillator = () => {
      const gainNode = { connect: (n: unknown) => n };
      return {
        type: 'sine',
        frequency: { value: 0 },
        connect: () => gainNode,
        start: (t: number) => started.push(t),
        stop: () => undefined,
      };
    };
  }
  return { Ctor: FakeContext as unknown as new () => AudioContext, started };
}

describe('suono di fine recupero', () => {
  it('senza sblocco non suona; dopo lo sblocco due note brevi', () => {
    const { Ctor, started } = fakeAudio('suspended');
    const beeper = createBeeper({ AudioContext: Ctor });
    expect(beeper.beep()).toBe(false);
    beeper.unlock();
    expect(beeper.unlocked).toBe(true);
    expect(beeper.beep()).toBe(true);
    expect(started).toHaveLength(2);
  });

  it('senza Web Audio non fa nulla e non lancia', () => {
    const beeper = createBeeper({});
    beeper.unlock();
    expect(beeper.unlocked).toBe(false);
    expect(beeper.beep()).toBe(false);
  });
});

function fakeWakeEnv(supported = true) {
  const listeners = new Set<() => void>();
  const sentinels: { released: boolean; fire: () => void }[] = [];
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  const request = vi.fn(async () => {
    let onRelease: () => void = () => undefined;
    const s = {
      released: false,
      fire: () => {
        s.released = true;
        onRelease();
      },
      release: async () => s.fire(),
      addEventListener: (_: 'release', fn: () => void) => (onRelease = fn),
    };
    sentinels.push(s);
    return s;
  });
  const env = {
    navigator: supported ? { wakeLock: { request } } : {},
    document: doc,
  } as unknown as WakeLockEnv;
  const setVisible = (visible: boolean) => {
    doc.visibilityState = visible ? 'visible' : 'hidden';
    for (const fn of listeners) fn();
  };
  return { env, request, sentinels, setVisible, listeners };
}

describe('schermo sempre acceso', () => {
  it('chiede il blocco, lo richiede al ritorno in primo piano (iOS lo rilascia), lo rilascia alla fine', async () => {
    const { env, request, sentinels, setVisible, listeners } = fakeWakeEnv();
    const awake = createKeepAwake(env);
    await awake.start();
    expect(awake.active).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);

    // In background iOS rilascia il blocco.
    setVisible(false);
    sentinels[0]!.fire();
    expect(awake.active).toBe(false);
    setVisible(true);
    await vi.waitFor(() => expect(awake.active).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);

    awake.stop();
    expect(awake.active).toBe(false);
    expect(sentinels[1]!.released).toBe(true);
    expect(listeners.size).toBe(0);
    setVisible(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('senza API non succede nulla', async () => {
    const { env } = fakeWakeEnv(false);
    const awake = createKeepAwake(env);
    await awake.start();
    expect(awake.active).toBe(false);
    awake.stop();
  });
});
