import { z } from 'zod';
import { dietLogSchema, type DietLogDay } from '../../../src/lib/data/schemas/diet-log';
import { dietPayloadSchema } from '../../../src/lib/data/schemas/diet-payload';
import { dietPayloadV2ToV3 } from '../../../src/lib/data/migrations/diet-v3';
import { migrateDietLogRow } from '../../../src/lib/data/migrations/diet-v3';
import type { DietPlan } from '../../../src/lib/data/schemas/diet-plans';
import type { Session } from '../../../src/lib/data/schemas/sessions';
import type { Workout } from '../../../src/lib/data/schemas/workouts';
import { buildSession } from '../../../src/lib/sessions/create';
import extendedJson from '../../fixtures/diet-extended.json';
import partialJson from '../../fixtures/home/diet-partial.json';
import logSwapJson from '../../fixtures/home/log-swap.json';

function planFrom(json: { id: string; title: string }): DietPlan {
  return {
    id: json.id,
    version: 1,
    title: json.title,
    author: '',
    validFrom: null,
    active: true,
    archived: false,
    importedAt: null,
    origin: 'file',
    // Fixture nel formato v2 (prima del 2b): convertita come nella migrazione.
    payload: dietPayloadSchema.parse(dietPayloadV2ToV3(structuredClone(json) as Record<string, unknown>)),
  };
}

/** Piano esteso finto (7 giorni: palestra lun/mar/gio/ven, riposo mer/dom, corsa sab). */
export const extendedPlan = (): DietPlan => planFrom(extendedJson);
/** Piano finto parziale (solo lun–ven; pasti vuoti, pasto libero, pre-workout, integratori vari). */
export const partialPlan = (): DietPlan => planFrom(partialJson);

/** Diario finto: oggi (lun 12/10) segue mercoledì; domenica 11 colazione e pranzo; sabato 10 di un altro piano. */
export function swapLogs(): DietLogDay[] {
  return z.array(dietLogSchema).parse(structuredClone(logSwapJson).map(migrateDietLogRow));
}

export const TODAY = '2026-10-12';

/** Sessione di una scheda iniziata `start` (ora locale) e, se c'è `end`, conclusa. */
export function sessionOf(workout: Workout, id: string, start: Date, end: Date | null): Session {
  const s = buildSession({
    id,
    workout,
    readiness: { sleep: 4, mood: 4, energy: 4, stress: 4, soreness: 4 },
    previous: null,
    now: start,
  });
  return { ...s, endedAt: end ? end.toISOString() : null, live: end ? null : s.live };
}
