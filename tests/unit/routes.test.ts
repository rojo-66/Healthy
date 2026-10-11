import { describe, expect, it } from 'vitest';
import { parseHash, parseQuery, routeHref } from '../../src/lib/routes';

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

  it('dieta e completamento guidato', () => {
    expect(parseHash('#/dieta')).toBe('/dieta');
    expect(parseHash('#/dieta/completa')).toBe('/dieta/completa');
  });

  it('allena, editor e anteprima con i parametri', () => {
    expect(parseHash('#/allena')).toBe('/allena');
    expect(parseHash('#/allena/editor?id=abc')).toBe('/allena/editor');
    expect(parseHash('#/allena/vedi?id=abc')).toBe('/allena/vedi');
    expect(parseQuery('#/allena/editor?id=abc&bozza=1')).toEqual({ id: 'abc', bozza: '1' });
    expect(parseQuery('#/allena/editor')).toEqual({});
    expect(parseQuery('#import=N4Ig?id=1')).toEqual({});
    expect(routeHref('/allena/editor', { id: 'a b', bozza: undefined })).toBe('#/allena/editor?id=a+b');
    expect(routeHref('/allena')).toBe('#/allena');
  });

  it('rotta sconosciuta → Home', () => {
    expect(parseHash('#/nonesiste')).toBe('/');
  });

  it('i link di condivisione (#import=…) non sono rotte', () => {
    expect(parseHash('#import=N4Ig')).toBeNull();
  });
});
