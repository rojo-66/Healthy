import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../../src/lib/data/backup';
import { parseDietFile } from '../../../src/lib/data/read-file';
import backupHome from '../../fixtures/home/backup-home.json';
import backupWorkoutsOnly from '../../fixtures/home/backup-workouts-only.json';
import partial from '../../fixtures/home/diet-partial.json';
import { swapLogs } from './helpers';

describe('fixture finte della Home', () => {
  it('i backup per gli e2e passano la validazione vera (schede con orario)', () => {
    const full = parseBackup(structuredClone(backupHome));
    expect(full.ok).toBe(true);
    if (full.ok) {
      expect(full.value.tables.workouts.find((w) => w.name === 'Petto + Schiena')?.time).toBe('18:00');
      expect(full.value.tables.dietPlans).toHaveLength(1);
    }
    expect(parseBackup(structuredClone(backupWorkoutsOnly)).ok).toBe(true);
  });

  it('il piano parziale e il diario con lo scambio sono validi', () => {
    expect(parseDietFile(structuredClone(partial)).ok).toBe(true);
    expect(swapLogs()).toHaveLength(3);
  });
});
