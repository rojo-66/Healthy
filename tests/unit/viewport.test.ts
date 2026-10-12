import { describe, expect, it } from 'vitest';
import { isKeyboardOpen, opensKeyboard, shouldResetScroll } from '../../src/lib/design/viewport.svelte';

describe('tastiera di iPhone', () => {
  it('aperta quando l’area visibile si restringe di molto', () => {
    expect(isKeyboardOpen(844, 844)).toBe(false);
    expect(isKeyboardOpen(844, 760)).toBe(false); // barra degli strumenti, non tastiera
    expect(isKeyboardOpen(844, 500)).toBe(true);
    expect(isKeyboardOpen(844, null)).toBe(false);
  });

  it('solo i campi di testo aprono la tastiera', () => {
    const text = document.createElement('input');
    const check = document.createElement('input');
    check.type = 'checkbox';
    expect(opensKeyboard(text)).toBe(true);
    expect(opensKeyboard(check)).toBe(false);
    expect(opensKeyboard(document.createElement('textarea'))).toBe(true);
    expect(opensKeyboard(document.createElement('button'))).toBe(false);
    expect(opensKeyboard(null)).toBe(false);
  });
});

describe('scroll da riportare a 0', () => {
  const base = { scrollY: 120, scrollHeight: 844, innerHeight: 844, keyboardOpen: false, focusedOpensKeyboard: false };

  it('dopo tastiera o background la pagina spostata torna a posto', () => {
    expect(shouldResetScroll(base)).toBe(true);
  });

  it('mai mentre si scrive', () => {
    expect(shouldResetScroll({ ...base, keyboardOpen: true })).toBe(false);
    expect(shouldResetScroll({ ...base, focusedOpensKeyboard: true })).toBe(false);
  });

  it('niente da fare se è già a posto o se la pagina scorre davvero', () => {
    expect(shouldResetScroll({ ...base, scrollY: 0 })).toBe(false);
    expect(shouldResetScroll({ ...base, scrollHeight: 3000 })).toBe(false);
  });
});
