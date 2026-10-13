import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../../src/lib/data/backup';
import backup from '../../fixtures/calendar/backup-calendar.json';

/** Fixture e2e del calendario (2c): un backup del formato 1 con un piano v3 a varianti, migrato fino al 4. */
describe('fixture finta del calendario', () => {
  it('è un backup valido dopo la migrazione, con schede, corsa, piano a varianti e il diario di prima', () => {
    const result = parseBackup(backup);
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (!result.ok) return;
    const { workouts, runs, dietPlans, dietLog, settings } = result.value.tables;
    expect(workouts.map((w) => [w.name, w.weekdays])).toEqual([
      ['Petto', [1]],
      ['Spalle', [5]],
    ]);
    expect(runs.map((r) => r.weekdays)).toEqual([[3]]);
    expect(dietPlans[0]!.payload.days[0]!.variants).toHaveLength(2);
    expect(dietLog[0]!.mealSources).toEqual({ colazione: { weekday: 1, type: null }, pranzo: { weekday: 1, type: null } });
    expect(settings.find((s) => s.key === 'calendarStart')?.value).toBe('2026-10-11');
  });
});
