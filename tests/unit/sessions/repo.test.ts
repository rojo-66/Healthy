import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../src/lib/data/db';
import { ValidationError } from '../../../src/lib/data/errors';
import {
  ActiveSessionError,
  activeSession,
  completedSessions,
  deleteSession,
  lastCompletedForWorkout,
  saveSession,
  startSession,
} from '../../../src/lib/data/repo/sessions';
import { finish, goToItem, setRest } from '../../../src/lib/sessions/edit';
import { startRest } from '../../../src/lib/sessions/rest-timer';
import { createSessionWriter, TYPING_DELAY_MS } from '../../../src/lib/sessions/writer';
import { resetDb } from '../data/helpers';
import { check, newSession, START } from './helpers';

beforeEach(resetDb);

const at = (days: number, hour = 18) => new Date(2026, 9, 12 + days, hour, 0);

describe('sessione in corso nel database', () => {
  it('ripresa dopo la chiusura dell’app: stessa sessione, stesso esercizio, stesso recupero', async () => {
    let s = newSession();
    await startSession(s);
    s = check(s, [0, 0], [0, 1]);
    s = goToItem(s, 1);
    s = setRest(s, startRest(90, START.getTime() + 60_000));
    await saveSession(s);

    // "Riapro l'app": rileggo dal database.
    db.close();
    await db.open();
    const resumed = await activeSession();
    expect(resumed?.id).toBe(s.id);
    expect(resumed?.live?.itemIndex).toBe(1);
    expect(resumed?.live?.rest?.endsAt).toBe(new Date(START.getTime() + 150_000).toISOString());
    expect(resumed?.sets.filter((x) => x.done)).toHaveLength(2);
  });

  it('una sola sessione in corso per volta', async () => {
    await startSession(newSession({ id: 'a' }));
    const err = await startSession(newSession({ id: 'b', now: at(0, 19) })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ActiveSessionError);
    expect((err as ActiveSessionError).active.id).toBe('a');
    expect(await db.sessions.count()).toBe(1);
    // Abbandona e inizia la nuova.
    await deleteSession('a');
    await startSession(newSession({ id: 'b', now: at(0, 19) }));
    expect((await activeSession())?.id).toBe('b');
  });

  it('sessione non valida: nessuna scrittura', async () => {
    const s = { ...newSession(), rpe: 11 };
    await expect(startSession(s)).rejects.toBeInstanceOf(ValidationError);
    expect(await db.sessions.count()).toBe(0);
  });

  it('ultima sessione conclusa della scheda, prima di un istante; storico solo concluse', async () => {
    const old = finish(newSession({ id: 'old', now: at(-7) }), at(-7, 19));
    const mid = finish(newSession({ id: 'mid', now: at(-3) }), at(-3, 19));
    const running = newSession({ id: 'run', now: at(0) });
    await db.sessions.bulkPut([old, mid, running]);
    const wid = running.workoutId;
    expect((await lastCompletedForWorkout(wid))?.id).toBe('mid');
    expect((await lastCompletedForWorkout(wid, mid.startedAt))?.id).toBe('old');
    expect(await lastCompletedForWorkout('altra')).toBeUndefined();
    expect((await completedSessions()).map((x) => x.id)).toEqual(['old', 'mid']);
    expect((await activeSession())?.id).toBe('run');
  });
});

describe('coda delle scritture', () => {
  it('in ordine, l’ultima vince; il testo si salva dopo una pausa o subito con flush', async () => {
    vi.useFakeTimers();
    try {
      const written: string[] = [];
      const writer = createSessionWriter(async (s) => {
        written.push(s.workoutName);
      });
      const base = newSession();
      void writer.save({ ...base, workoutName: 'uno' });
      writer.saveLater({ ...base, workoutName: 'due' });
      writer.saveLater({ ...base, workoutName: 'tre' });
      await vi.advanceTimersByTimeAsync(TYPING_DELAY_MS - 1);
      expect(written).toEqual(['uno']);
      await vi.advanceTimersByTimeAsync(1);
      expect(written).toEqual(['uno', 'tre']);

      writer.saveLater({ ...base, workoutName: 'quattro' });
      await writer.flush();
      expect(written).toEqual(['uno', 'tre', 'quattro']);
      await vi.advanceTimersByTimeAsync(TYPING_DELAY_MS * 2);
      expect(written).toHaveLength(3);

      // Una scrittura immediata annulla quella in attesa (ne contiene già lo stato).
      writer.saveLater({ ...base, workoutName: 'cinque' });
      await writer.save({ ...base, workoutName: 'sei' });
      await vi.advanceTimersByTimeAsync(TYPING_DELAY_MS * 2);
      expect(written).toEqual(['uno', 'tre', 'quattro', 'sei']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('un errore non blocca la coda e resta leggibile', async () => {
    let fail = true;
    const writer = createSessionWriter(async () => {
      if (fail) throw new Error('disco pieno');
    });
    await writer.save(newSession());
    expect(writer.error).toBeInstanceOf(Error);
    fail = false;
    await writer.save(newSession());
    expect(writer.error).toBeNull();
  });
});
