import { describe, expect, it, vi } from 'vitest';
import { deliverFile, type DeliveryEnv } from '../../../src/lib/data/deliver-file';

function domError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function makeEnv(nav: DeliveryEnv['navigator']) {
  const clicked: { href: string; download: string }[] = [];
  const createElement = ((tag: string) => {
    const el = document.createElement(tag);
    if (el instanceof HTMLAnchorElement) {
      el.click = () => clicked.push({ href: el.href, download: el.download });
    }
    return el;
  }) as Document['createElement'];
  const timers: (() => void)[] = [];
  const env: DeliveryEnv = {
    navigator: nav,
    document: { createElement, body: document.body },
    url: { createObjectURL: vi.fn(() => 'blob:finto'), revokeObjectURL: vi.fn() },
    setTimeout: (callback) => timers.push(callback),
  };
  return { env, clicked, timers };
}

const file = new File(['{}'], 'healthy-backup-2026-10-11.json', { type: 'application/json' });

describe('deliverFile', () => {
  it('Web Share con file disponibile → foglio di condivisione', async () => {
    const share = vi.fn(async () => {});
    const { env, clicked } = makeEnv({ canShare: () => true, share });
    expect(await deliverFile(file, env)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file] });
    expect(clicked).toEqual([]);
  });

  it('annullato dall’utente → nessun errore, nessun download', async () => {
    const { env, clicked } = makeEnv({ canShare: () => true, share: () => Promise.reject(domError('AbortError')) });
    expect(await deliverFile(file, env)).toBe('cancelled');
    expect(clicked).toEqual([]);
  });

  it('gesto scaduto (Safari) → serve un nuovo tocco', async () => {
    const { env, clicked } = makeEnv({ canShare: () => true, share: () => Promise.reject(domError('NotAllowedError')) });
    expect(await deliverFile(file, env)).toBe('needs-gesture');
    expect(clicked).toEqual([]);
  });

  it('altro errore di condivisione → download', async () => {
    const { env, clicked } = makeEnv({ canShare: () => true, share: () => Promise.reject(new TypeError('x')) });
    expect(await deliverFile(file, env)).toBe('downloaded');
    expect(clicked).toHaveLength(1);
  });

  it('niente Web Share, o file non condivisibili → download classico', async () => {
    for (const nav of [{}, { share: vi.fn() }, { canShare: () => false, share: vi.fn() }]) {
      const { env, clicked, timers } = makeEnv(nav);
      expect(await deliverFile(file, env)).toBe('downloaded');
      expect(clicked).toEqual([{ href: 'blob:finto', download: 'healthy-backup-2026-10-11.json' }]);
      expect(document.querySelector('a[download]')).toBeNull();
      // L'URL temporaneo viene liberato più tardi, non subito (Safari).
      expect(env.url.revokeObjectURL).not.toHaveBeenCalled();
      timers.forEach((t) => t());
      expect(env.url.revokeObjectURL).toHaveBeenCalledWith('blob:finto');
    }
  });

  it('canShare che lancia → download', async () => {
    const { env } = makeEnv({
      canShare: () => {
        throw new Error('x');
      },
      share: vi.fn(),
    });
    expect(await deliverFile(file, env)).toBe('downloaded');
  });
});
