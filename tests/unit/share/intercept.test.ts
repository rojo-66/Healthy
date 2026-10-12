import { describe, expect, it } from 'vitest';
import {
  interceptImportHash,
  LINK_IMPORT_HASH,
  pendingImport,
  takePendingImport,
  type InterceptEnv,
} from '../../../src/lib/share/import/pending.svelte';
import { parseHash, parseQuery } from '../../../src/lib/routes';

function fakeWindow(hash: string) {
  const listeners: (() => void)[] = [];
  const calls: string[] = [];
  const env: InterceptEnv = {
    location: {
      hash,
      replace(url: string) {
        calls.push(`replace ${url}`);
        env.location.hash = url;
      },
    },
    history: {
      state: null,
      replaceState(_data, _unused, url) {
        calls.push(`replaceState ${url}`);
        env.location.hash = url;
      },
    },
    addEventListener: (_type, listener) => listeners.push(listener),
  };
  const navigate = (next: string) => {
    env.location.hash = next;
    listeners.forEach((l) => l());
  };
  return { env, calls, navigate };
}

describe('intercettazione di #import= prima del router', () => {
  it('all’avvio: codice in memoria, indirizzo ripulito senza nuova voce, il router vede #/importa', () => {
    const { env, calls } = fakeWindow('#import=AbC$-+');
    const before = pendingImport.token;
    interceptImportHash(env);
    expect(calls).toEqual([`replaceState ${LINK_IMPORT_HASH}`]);
    expect(pendingImport.token).toBe(before + 1);
    expect(takePendingImport()).toBe('AbC$-+');
    expect(takePendingImport()).toBeNull(); // una volta sola: ricaricando non si reimporta
    expect(parseHash(env.location.hash)).toBe('/importa');
    expect(parseQuery(env.location.hash)).toEqual({ da: 'link' });
  });

  it('le rotte normali non vengono toccate', () => {
    for (const hash of ['', '#/', '#/allena?id=abc', '#/importa?da=allena']) {
      const { env, calls } = fakeWindow(hash);
      interceptImportHash(env);
      expect(calls).toEqual([]);
      expect(env.location.hash).toBe(hash);
    }
  });

  it('app già aperta: un nuovo link (hashchange) sostituisce la voce con #/importa', () => {
    const { env, calls, navigate } = fakeWindow('#/allena');
    interceptImportHash(env);
    const before = pendingImport.token;
    navigate('#/dieta');
    expect(calls).toEqual([]);
    navigate('#import=XyZ');
    expect(calls).toEqual([`replace ${LINK_IMPORT_HASH}`]);
    expect(pendingImport.token).toBe(before + 1);
    expect(takePendingImport()).toBe('XyZ');
  });
});
