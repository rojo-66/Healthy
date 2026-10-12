import { describe, expect, it } from 'vitest';
import type { Session } from '../../../src/lib/data/schemas/sessions';
import { addDays } from '../../../src/lib/diet/calc/calendar';
import { bodySeries } from '../../../src/lib/progress/body';
import { periodRange } from '../../../src/lib/progress/period';
import { markerIndexes, MANY_POINTS } from '../../../src/lib/progress/series';
import { exerciseChoices, exerciseView, recentRecords, strengthIndex, weeklyWorkouts } from '../../../src/lib/progress/strength';
import { measurement, PROFILE } from '../profile/helpers';
import { progressTables, TODAY } from './helpers';

/** Tanti anni di allenamenti finti: le sessioni della fixture ripetute nel passato. */
function manySessions(copies: number): Session[] {
  const base = progressTables().sessions;
  const out: Session[] = [];
  for (let c = 0; c < copies; c++) {
    const shift = -91 * (c + 1);
    for (const s of base) {
      const day = addDays(s.startedAt.slice(0, 10), shift);
      out.push({
        ...s,
        id: `${s.id.slice(0, -4)}${String(c).padStart(4, '0')}`,
        startedAt: `${day}${s.startedAt.slice(10)}`,
        endedAt: s.endedAt ? `${day}${s.endedAt.slice(10)}` : null,
      });
    }
  }
  return [...out, ...base];
}

describe('prestazioni: centinaia di sessioni e serie lunghe', () => {
  it('oltre 600 sessioni: indice, scelte, grafico, settimane e record in poco tempo', () => {
    const sessions = manySessions(16);
    expect(sessions.length).toBeGreaterThan(600);
    const started = performance.now();
    const index = strengthIndex(sessions);
    const choices = exerciseChoices(index);
    const range = periodRange('all', TODAY, sessions.map((s) => s.startedAt.slice(0, 10)).sort()[0]!);
    const view = exerciseView(choices[0], 'load', range);
    weeklyWorkouts(sessions, progressTables().workouts, range, TODAY);
    recentRecords(index, range);
    const elapsed = performance.now() - started;
    expect(view.points.length).toBeGreaterThan(MANY_POINTS);
    expect(elapsed).toBeLessThan(1500);
  });

  it('peso giornaliero per 2 anni: serie lunga, pallini solo su selezionato, minimo e massimo', () => {
    const list = Array.from({ length: 730 }, (_, i) =>
      measurement({ id: `m${i}`, date: addDays('2024-10-13', i), weightKg: 80 + Math.sin(i / 20) * 3 }),
    );
    const weight = bodySeries(list, PROFILE).weight;
    expect(weight).toHaveLength(730);
    expect(markerIndexes(weight, 729).size).toBeLessThanOrEqual(3);
  });
});
