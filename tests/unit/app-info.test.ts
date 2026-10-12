import { describe, expect, it } from 'vitest';
import { APP_INFO, versionLabel } from '../../src/lib/app-info';
import pkg from '../../package.json';

describe('versione e build (Profilo › Informazioni)', () => {
  it('versione dal package.json', () => {
    expect(APP_INFO.version).toBe(pkg.version);
  });

  it('build e commit di GitHub Actions; fuori da CI "locale" senza commit', () => {
    expect(versionLabel({ version: '0.7.0', build: '42', commit: '1a2b3c4' })).toBe('Versione 0.7.0 · build 42 (1a2b3c4)');
    expect(versionLabel({ version: '0.7.0', build: 'locale', commit: '' })).toBe('Versione 0.7.0 · build locale');
  });
});
