// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSetting } from '../../../src/lib/data/repo/settings';
import { formatBytes, getStorageStatus, initStorage, requestPersistence, type StorageLike } from '../../../src/lib/data/storage';
import { resetDb } from './helpers';

const now = new Date('2026-10-11T08:00:00.000Z');

beforeEach(resetDb);

describe('requestPersistence', () => {
  it('API assente → null', async () => {
    expect(await requestPersistence(undefined)).toBeNull();
    expect(await requestPersistence({})).toBeNull();
  });

  it('già persistente: non chiede di nuovo', async () => {
    const persist = vi.fn(async () => true);
    expect(await requestPersistence({ persisted: async () => true, persist })).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('chiede la persistenza (concessa o negata)', async () => {
    expect(await requestPersistence({ persisted: async () => false, persist: async () => true })).toBe(true);
    expect(await requestPersistence({ persisted: async () => false, persist: async () => false })).toBe(false);
  });

  it('errore del browser → null, nessuna eccezione', async () => {
    expect(await requestPersistence({ persist: () => Promise.reject(new Error('no')) })).toBeNull();
  });

  it('chiama i metodi con il loro `this` (come navigator.storage)', async () => {
    const storage = {
      granted: true,
      persist(this: { granted: boolean }) {
        return Promise.resolve(this.granted);
      },
    };
    expect(await requestPersistence(storage as StorageLike)).toBe(true);
  });
});

describe('initStorage', () => {
  it('salva l’esito in settings', async () => {
    expect(await initStorage({ persisted: async () => false, persist: async () => false }, now)).toBe(false);
    expect(await getSetting('storagePersist')).toEqual({ granted: false, checkedAt: '2026-10-11T08:00:00.000Z' });

    expect(await initStorage({ persisted: async () => false, persist: async () => true }, now)).toBe(true);
    expect(await getSetting('storagePersist')).toEqual({ granted: true, checkedAt: '2026-10-11T08:00:00.000Z' });
  });

  it('senza API non salva nulla', async () => {
    expect(await initStorage(undefined, now)).toBeNull();
    expect(await getSetting('storagePersist')).toBeNull();
  });
});

describe('getStorageStatus', () => {
  it('persistenza e spazio usato', async () => {
    const status = await getStorageStatus({
      persisted: async () => true,
      estimate: async () => ({ usage: 1234, quota: 1_000_000 }),
    });
    expect(status).toEqual({ supported: true, persisted: true, usageBytes: 1234, quotaBytes: 1_000_000 });
  });

  it('valori mancanti → null', async () => {
    expect(await getStorageStatus({ estimate: async () => ({}) })).toEqual({
      supported: true,
      persisted: null,
      usageBytes: null,
      quotaBytes: null,
    });
    expect(await getStorageStatus(undefined)).toEqual({
      supported: false,
      persisted: null,
      usageBytes: null,
      quotaBytes: null,
    });
  });
});

describe('formatBytes', () => {
  it('unità e decimali in italiano', () => {
    expect(formatBytes(0)).toBe('0 byte');
    expect(formatBytes(812)).toBe('812 byte');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(1.4 * 1024 * 1024)).toBe('1,4 MB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
    expect(formatBytes(2 * 1024 ** 3)).toBe('2 GB');
  });
});
