import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../../src/lib/data/backup';
import backupProgress from '../../fixtures/progress/backup-progress.json';
import { progressTables } from './helpers';

describe('fixture finta di Progressi (e2e e unitari)', () => {
  it('è un backup valido con 3 mesi di dati di ogni tipo', () => {
    const result = parseBackup(structuredClone(backupProgress));
    expect(result.ok ? [] : result.errors).toEqual([]);
    const t = progressTables();
    expect(t.measurements.length).toBeGreaterThanOrEqual(10);
    expect(t.sessions.length).toBeGreaterThanOrEqual(30);
    expect(t.dietPlans.filter((p) => p.active)).toHaveLength(1);
    expect(t.dietLog.length).toBeGreaterThan(30);
    expect(t.settings.find((s) => s.key === 'nextMeasurement')?.value).toMatchObject({ date: '2026-11-13' });
  });

  it('contiene i casi limite: misura senza peso, settimana senza sessioni, giorno senza diario, scambio', () => {
    const t = progressTables();
    expect(t.measurements.some((m) => m.weightKg === null)).toBe(true);
    expect(t.sessions.some((s) => s.startedAt >= '2026-08-10' && s.startedAt < '2026-08-17')).toBe(false);
    expect(t.dietLog.some((l) => l.date === '2026-10-04')).toBe(false);
    expect(t.dietLog.some((l) => l.swappedFromWeekday !== null)).toBe(true);
  });
});
