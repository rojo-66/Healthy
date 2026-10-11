import { z } from 'zod';
import { MAX_TEXT } from '../limits';
import { entityId, isoDate, num, text } from './common';

/** Valore misurato: assente = `null`. FFM%, BCM%, BMI, ECW/TBW si calcolano (SPEC § 6.3), non si salvano. */
const metric = (max: number) => num(0, max).nullable();

export const measurementSchema = z.object({
  id: entityId,
  date: isoDate,
  weightKg: metric(400),
  fmKg: metric(300),
  fmPct: metric(100),
  ffmKg: metric(300),
  bcmKg: metric(200),
  tbwL: metric(200),
  ecwL: metric(200),
  phaDeg: metric(30),
  bmrKcal: metric(10000),
  chestCm: metric(300),
  waistCm: metric(300),
  abdomenCm: metric(300),
  hipsCm: metric(300),
  thighCm: metric(300),
  armCm: metric(300),
  calfCm: metric(300),
  notes: text(MAX_TEXT.note),
});

export type Measurement = z.infer<typeof measurementSchema>;
