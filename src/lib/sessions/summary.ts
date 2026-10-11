import type { Session, SessionSet } from '../data/schemas/sessions';
import { compareWithLast, type Delta } from './compare';
import { noteFor } from './edit';
import { setLabel } from './format';
import { sessionItems } from './items';
import { readinessTotal } from './readiness';
import { sessionRecords } from './records';
import { bestSet, doneFor, doneSets, durationSec, isExtra, missingSets, plannedFor, plannedSets, setsOf, volume } from './stats';

export interface SetLine {
  n: number;
  /** "57,5 × 10", oppure "saltata". */
  text: string;
  done: boolean;
  extra: boolean;
  pr: boolean;
}

export interface ExerciseSummary {
  index: number;
  name: string;
  done: number;
  planned: number;
  best: SessionSet | null;
  volume: number;
  delta: Delta;
  pr: boolean;
  sets: SetLine[];
  note: string;
}

export interface SessionSummary {
  durationSec: number;
  volume: number;
  done: number;
  planned: number;
  skipped: number;
  records: number;
  /** Esercizi con un PR, nell'ordine della scheda. */
  recordNames: string[];
  readinessTotal: number | null;
  cardio: { type: string; minutes: number; done: boolean } | null;
  exercises: ExerciseSummary[];
}

/**
 * Tutto ciò che mostra il Riepilogo (e il testo per il PT), calcolato una volta.
 * `previous` = ultima sessione conclusa con la stessa scheda prima di questa; `all` = sessioni per i PR.
 */
export function summarize(
  session: Session,
  previous: Session | null | undefined,
  all: readonly Session[],
  now: number = Date.now(),
): SessionSummary {
  const items = sessionItems(session);
  const prs = sessionRecords(session, all);
  const exercises = items.map((item, index): ExerciseSummary => {
    const sets = setsOf(session, index);
    const prSets = new Set(prs.get(index) ?? []);
    return {
      index,
      name: item.name,
      done: doneFor(session, index),
      planned: plannedFor(session, index),
      best: bestSet(sets),
      volume: volume(sets),
      delta: compareWithLast(session, index, previous),
      pr: prSets.size > 0,
      sets: sets
        .filter((s) => s.done || !isExtra(session, s))
        .map((s) => ({
          n: s.setIndex + 1,
          text: s.done ? setLabel(s.kg, s.reps) : 'saltata',
          done: s.done,
          extra: isExtra(session, s),
          pr: prSets.has(s.setIndex),
        })),
      note: noteFor(session, index),
    };
  });
  const cardio = session.snapshot?.cardio;
  return {
    durationSec: durationSec(session, now),
    volume: volume(session.sets),
    done: doneSets(session),
    planned: plannedSets(session),
    skipped: missingSets(session),
    records: exercises.filter((e) => e.pr).length,
    recordNames: exercises.filter((e) => e.pr).map((e) => e.name),
    readinessTotal: session.readiness ? readinessTotal(session.readiness) : null,
    cardio:
      cardio && cardio.minutes > 0
        ? { type: cardio.type, minutes: cardio.minutes, done: session.cardioDone !== null }
        : session.cardioDone
          ? { type: session.cardioDone.type, minutes: session.cardioDone.minutes, done: true }
          : null,
    exercises,
  };
}
