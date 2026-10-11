import { describe, expect, it } from 'vitest';
import { payloadOf } from '../../../src/lib/data/repo/diet-plans';
import { nextMeal } from '../../../src/lib/sessions/next-meal';
import { extendedFile } from '../diet/helpers';

describe('prossimo pasto nel riepilogo (piano attivo)', () => {
  const plan = payloadOf(extendedFile());

  it('dopo l’allenamento delle 18:40: lo spuntino del momento (Whey), poi la cena', () => {
    const now = nextMeal(plan, 1, undefined, 18 * 60 + 40);
    expect(now).toMatchObject({ isNow: true, meal: { key: 'spuntino2', name: 'Whey in acqua' } });
    const later = nextMeal(plan, 1, { eaten: { spuntino2: true }, swappedFromWeekday: null }, 19 * 60 + 10);
    expect(later).toMatchObject({ isNow: false, meal: { key: 'cena', time: '20:30' } });
  });

  it('a fine giornata nessun pasto; giorno inesistente nel piano → niente', () => {
    expect(nextMeal(plan, 1, { eaten: { cena: true }, swappedFromWeekday: null }, 22 * 60)).toBeNull();
    expect(nextMeal({ ...plan, days: [] }, 1, undefined, 12 * 60)).toBeNull();
  });
});
