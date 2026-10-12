import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../../src/lib/data/backup';
import { compareMetrics } from '../../../src/lib/profile/compare';
import { deriveMetrics, latestWeight } from '../../../src/lib/profile/metrics';
import { defaultPair, pickDate, resolvePair } from '../../../src/lib/profile/selection';
import backupProfile from '../../fixtures/profile/backup-profile.json';
import { measurement } from './helpers';

describe('fixture finta del Profilo (e2e)', () => {
  it('è un backup valido, con profilo, 3 misure e le impostazioni', () => {
    const result = parseBackup(backupProfile);
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (!result.ok) return;
    const { profile, measurements, settings } = result.value.tables;
    expect(profile[0]).toMatchObject({ goal: 'lose', activityLevel: 'active' });
    expect(measurements).toHaveLength(3);
    expect(settings.map((s) => s.key).sort()).toEqual(['nextMeasurement', 'workoutAuthor']);
    // L'ultima misura ha solo vita e addome: l'ultimo peso è quello prima.
    expect(latestWeight(measurements)).toBe(80.2);
  });

  it('ultima misura parziale: i valori che mancano non hanno variazione', () => {
    const result = parseBackup(backupProfile);
    if (!result.ok) throw new Error('fixture non valida');
    const [, second, third] = result.value.tables.measurements;
    const p = result.value.tables.profile[0];
    const rows = compareMetrics(deriveMetrics(third!, p), deriveMetrics(second!, p), 'lose');
    expect(rows.weight).toMatchObject({ now: null, delta: null });
    expect(rows.waist).toMatchObject({ delta: -1.5, tone: 'good' });
  });
});

describe('date a confronto', () => {
  const list = [
    measurement({ id: 'a', date: '2026-07-03' }),
    measurement({ id: 'b', date: '2026-08-14' }),
    measurement({ id: 'c', date: '2026-09-25' }),
  ];

  it('predefinito: ultima e precedente; una sola misura: niente precedente', () => {
    expect(defaultPair(list)).toEqual({ beforeId: 'b', afterId: 'c' });
    expect(defaultPair([list[0]!])).toEqual({ beforeId: null, afterId: 'a' });
    expect(defaultPair([])).toEqual({ beforeId: null, afterId: null });
  });

  it('scelta valida finché le misure esistono, altrimenti torna al predefinito', () => {
    expect(resolvePair(list, { beforeId: 'a', afterId: 'b' })).toMatchObject({ before: { id: 'a' }, after: { id: 'b' } });
    // Misura eliminata
    expect(resolvePair(list, { beforeId: 'x', afterId: 'b' })).toMatchObject({ before: { id: 'b' }, after: { id: 'c' } });
    // Ordine invertito: la precedente è sempre la più vecchia
    expect(resolvePair(list, { beforeId: 'c', afterId: 'a' })).toMatchObject({ before: { id: 'a' }, after: { id: 'c' } });
  });

  it('cambiare una data: la scelta resta dal suo lato, l\'altra si sposta sulla misura vicina', () => {
    const cur = { beforeId: 'b', afterId: 'c' };
    expect(pickDate(list, cur, 'before', 'a')).toEqual({ beforeId: 'a', afterId: 'c' });
    // Attuale = la precedente di adesso: la precedente diventa quella prima.
    expect(pickDate(list, cur, 'after', 'b')).toEqual({ beforeId: 'a', afterId: 'b' });
    // Precedente = l'attuale di adesso: l'attuale diventa quella dopo.
    expect(pickDate(list, { beforeId: 'a', afterId: 'b' }, 'before', 'b')).toEqual({ beforeId: 'b', afterId: 'c' });
    // La più recente può essere solo attuale, la più vecchia solo precedente.
    expect(pickDate(list, cur, 'before', 'c')).toEqual({ beforeId: 'b', afterId: 'c' });
    expect(pickDate(list, cur, 'after', 'a')).toEqual({ beforeId: 'a', afterId: 'b' });
    expect(pickDate(list, cur, 'after', 'x')).toEqual(cur);
  });
});
