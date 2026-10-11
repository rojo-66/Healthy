import { describe, expect, it } from 'vitest';
import { parseWorkoutFile } from '../../../src/lib/data/read-file';
import { savedDraftSchema } from '../../../src/lib/data/schemas/workout-draft';
import { workoutSchema } from '../../../src/lib/data/schemas/workouts';
import { draftFingerprint, draftFromWorkout, draftToCandidate } from '../../../src/lib/workouts/draft';
import { validateDraft } from '../../../src/lib/workouts/calc/editor-schema';
import { addMinutesToTime, parseTimeInput, workoutTimeRange } from '../../../src/lib/workouts/format';
import workoutFile from '../../fixtures/workout.json';
import { workoutNamed } from './helpers';

describe('orario delle schede (M6)', () => {
  it('facoltativo: le schede salvate prima valgono con orario vuoto', () => {
    const { time: _t, ...old } = workoutNamed('Gambe');
    expect(workoutSchema.parse(old).time).toBeNull();
    expect(workoutSchema.parse({ ...old, time: '18:00' }).time).toBe('18:00');
    expect(workoutSchema.safeParse({ ...old, time: '25:00' }).success).toBe(false);
    expect(workoutSchema.safeParse({ ...old, time: '18' }).success).toBe(false);
  });

  it('nel file § 8.1 è facoltativo (schemaVersion invariata)', () => {
    const without = parseWorkoutFile(structuredClone(workoutFile));
    expect(without.ok && without.value.time).toBeNull();
    const withTime = parseWorkoutFile({ ...structuredClone(workoutFile), time: '07:15' });
    expect(withTime.ok && withTime.value.time).toBe('07:15');
    expect(parseWorkoutFile({ ...structuredClone(workoutFile), time: 'sera' }).ok).toBe(false);
  });

  it('bozza: le bozze salvate prima non lo hanno; cambiare orario è una modifica', () => {
    const w = { ...workoutNamed('Gambe'), time: '18:00' };
    const draft = draftFromWorkout(w);
    expect(draft.time).toBe('18:00');
    expect(draftToCandidate(draft).time).toBe('18:00');
    const { time: _t, ...oldDraft } = draft;
    expect(savedDraftSchema.parse({ savedAt: '2026-10-11T10:00:00.000Z', draft: oldDraft }).draft.time).toBeNull();
    expect(draftFingerprint({ ...draft, time: '19:00' })).not.toBe(draftFingerprint(draft));
    const valid = validateDraft({ ...draft, time: null });
    expect(valid.ok && valid.value.time).toBeNull();
  });

  it('campo orario e fascia stimata', () => {
    expect(parseTimeInput('18:00')).toBe('18:00');
    expect(parseTimeInput('07:05:00')).toBe('07:05');
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('7:5')).toBeNull();
    expect(addMinutesToTime('18:00', 75)).toBe('19:15');
    expect(addMinutesToTime('23:30', 45)).toBe('00:15');
    const w = workoutNamed('Gambe');
    expect(workoutTimeRange({ ...w, time: null })).toBe('');
    expect(workoutTimeRange({ ...w, time: '18:00' })).toMatch(/^18:00–\d{2}:\d{2}$/);
  });
});
