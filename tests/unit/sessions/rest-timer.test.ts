import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adjustRest,
  isFinished,
  isPaused,
  pauseRest,
  remainingMs,
  remainingSec,
  REST_PRESETS,
  restFraction,
  resumeRest,
  skipRest,
  startRest,
} from '../../../src/lib/sessions/rest-timer';
import { restTimerSchema } from '../../../src/lib/data/schemas/sessions';

// Orologio simulato: il timer legge solo l'istante passato, mai un contatore.
const T0 = new Date(2026, 9, 12, 18, 30).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('recupero basato su istanti', () => {
  it('avvio, conto alla rovescia, fine', () => {
    const t = startRest(90, Date.now());
    expect(restTimerSchema.parse(t)).toEqual(t);
    expect(t).toEqual({ totalSec: 90, endsAt: new Date(T0 + 90_000).toISOString(), pausedRemainingMs: null });
    expect(remainingSec(t, Date.now())).toBe(90);
    vi.advanceTimersByTime(500);
    expect(remainingSec(t, Date.now())).toBe(90); // per eccesso: 89,5 s → 90
    vi.advanceTimersByTime(30_000);
    expect(remainingSec(t, Date.now())).toBe(60);
    expect(restFraction(t, Date.now())).toBeCloseTo(59.5 / 90);
    expect(isFinished(t, Date.now())).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(remainingMs(t, Date.now())).toBe(0);
    expect(isFinished(t, Date.now())).toBe(true);
    expect(restFraction(t, Date.now())).toBe(0);
  });

  it('ripresa dopo una sospensione: il tempo resta giusto senza nessun tick', () => {
    const t = startRest(120, Date.now());
    // iOS sospende la pagina per 50 s: nessun setInterval gira, conta solo l'istante di ritorno.
    vi.setSystemTime(T0 + 50_000);
    expect(remainingSec(t, Date.now())).toBe(70);
    // Torna dopo 10 minuti: finito, non negativo.
    vi.setSystemTime(T0 + 600_000);
    expect(remainingSec(t, Date.now())).toBe(0);
    expect(isFinished(t, Date.now())).toBe(true);
  });

  it('pausa e ripresa', () => {
    const t = startRest(60, T0);
    const paused = pauseRest(t, T0 + 20_000);
    expect(isPaused(paused)).toBe(true);
    expect(paused).toEqual({ totalSec: 60, endsAt: null, pausedRemainingMs: 40_000 });
    // In pausa il tempo non scorre e non è "finito".
    expect(remainingSec(paused, T0 + 500_000)).toBe(40);
    expect(isFinished(paused, T0 + 500_000)).toBe(false);
    expect(pauseRest(paused, T0 + 30_000)).toBe(paused);
    const resumed = resumeRest(paused, T0 + 100_000);
    expect(isPaused(resumed)).toBe(false);
    expect(remainingSec(resumed, T0 + 100_000)).toBe(40);
    expect(remainingSec(resumed, T0 + 130_000)).toBe(10);
    expect(resumeRest(resumed, T0)).toBe(resumed);
    expect(pauseRest(null, T0)).toBeNull();
    expect(resumeRest(null, T0)).toBeNull();
  });

  it('±15 s: mai sotto zero; oltre la durata la durata cresce; anche in pausa', () => {
    const t = startRest(60, T0);
    const minus = adjustRest(t, -15, T0 + 10_000);
    expect(remainingSec(minus, T0 + 10_000)).toBe(35);
    expect(minus?.totalSec).toBe(60);
    expect(remainingSec(adjustRest(t, -15, T0 + 50_000), T0 + 50_000)).toBe(0);
    const plus = adjustRest(t, 15, T0);
    expect(remainingSec(plus, T0)).toBe(75);
    expect(plus?.totalSec).toBe(75);
    const paused = adjustRest(pauseRest(t, T0 + 30_000), 15, T0 + 99_000);
    expect(paused).toEqual({ totalSec: 60, endsAt: null, pausedRemainingMs: 45_000 });
    // Senza recupero: + ne avvia uno, − non fa niente.
    expect(remainingSec(adjustRest(null, 15, T0), T0)).toBe(15);
    expect(adjustRest(null, -15, T0)).toBeNull();
  });

  it('preset e salta', () => {
    expect(REST_PRESETS).toEqual([60, 90, 120, 180]);
    for (const p of REST_PRESETS) expect(remainingSec(startRest(p, T0), T0)).toBe(p);
    expect(skipRest()).toBeNull();
    expect(remainingSec(null, T0)).toBe(0);
    expect(isFinished(null, T0)).toBe(false);
    expect(restFraction(null, T0)).toBe(0);
    expect(startRest(99_999, T0).totalSec).toBe(3600);
  });
});
