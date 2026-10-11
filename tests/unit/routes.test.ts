import { describe, expect, it } from 'vitest';
import { parseHash } from '../../src/lib/routes';

describe('parseHash', () => {
  it('Home con hash vuoto', () => {
    expect(parseHash('')).toBe('/');
    expect(parseHash('#')).toBe('/');
    expect(parseHash('#/')).toBe('/');
  });

  it('pagina di prova, anche con barra finale o parametri', () => {
    expect(parseHash('#/showcase')).toBe('/showcase');
    expect(parseHash('#/showcase/')).toBe('/showcase');
    expect(parseHash('#/showcase?x=1')).toBe('/showcase');
  });

  it('pagina tecnica dei dati', () => {
    expect(parseHash('#/dev-data')).toBe('/dev-data');
  });

  it('rotta sconosciuta → Home', () => {
    expect(parseHash('#/nonesiste')).toBe('/');
  });

  it('i link di condivisione (#import=…) non sono rotte', () => {
    expect(parseHash('#import=N4Ig')).toBeNull();
  });
});
