import { validate } from '../data/errors';
import { MAX_TEXT } from '../data/limits';
import { runLogSchema, runSchema, type Run, type RunLog } from '../data/schemas/runs';
import { parseDecimalInput } from '../profile/number';

/**
 * Moduli della corsa (2a): attività pianificata (`RunEditor`) e corsa fatta (`RunLogSheet`).
 * Numeri come scritti dall'utente (virgola o punto), errori in italiano accanto al campo.
 */

export interface RunForm {
  name: string;
  weekdays: number[];
  time: string | null;
  targetMinutes: string;
  targetKm: string;
  note: string;
}

export type RunFieldErrors = Partial<Record<'name' | 'targetMinutes' | 'targetKm' | 'target' | 'note', string>>;

export function emptyRunForm(): RunForm {
  return { name: 'Corsa', weekdays: [], time: null, targetMinutes: '', targetKm: '', note: '' };
}

const decimalText = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

export function runToForm(run: Run): RunForm {
  return {
    name: run.name,
    weekdays: [...run.weekdays],
    time: run.time,
    targetMinutes: decimalText(run.targetMinutes),
    targetKm: decimalText(run.targetKm),
    note: run.note,
  };
}

/** Stesso contenuto? (per "Esci senza salvare"). */
export function sameRunForm(a: RunForm, b: RunForm): boolean {
  const norm = (f: RunForm) => JSON.stringify({ ...f, weekdays: [...f.weekdays].sort((x, y) => x - y) });
  return norm(a) === norm(b);
}

export type RunFormResult = { ok: true; value: Run } | { ok: false; errors: RunFieldErrors };

/** Modulo → corsa da salvare. Serve almeno un obiettivo (minuti e/o km). */
export function formToRun(form: RunForm, base: { id: string; createdAt: string }, now: Date): RunFormResult {
  const errors: RunFieldErrors = {};
  const name = form.name.trim();
  if (name === '') errors.name = 'Scrivi un nome.';
  else if (name.length > MAX_TEXT.name) errors.name = `Al massimo ${MAX_TEXT.name} caratteri.`;

  const minutes = parseDecimalInput(form.targetMinutes, { integer: true });
  if (!minutes.ok) errors.targetMinutes = minutes.error;
  else if (minutes.value !== null && (minutes.value < 1 || minutes.value > 600)) errors.targetMinutes = 'Da 1 a 600 minuti.';

  const km = parseDecimalInput(form.targetKm, { maxDecimals: 2 });
  if (!km.ok) errors.targetKm = km.error;
  else if (km.value !== null && (km.value < 0.1 || km.value > 500)) errors.targetKm = 'Da 0,1 a 500 km.';

  if (minutes.ok && km.ok && minutes.value === null && km.value === null) {
    errors.target = 'Indica almeno un obiettivo: minuti o km.';
  }
  if (form.note.trim().length > MAX_TEXT.note) errors.note = `Al massimo ${MAX_TEXT.note} caratteri.`;
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = validate(runSchema, {
    id: base.id,
    name,
    weekdays: [...form.weekdays].sort((a, b) => a - b),
    time: form.time,
    targetMinutes: minutes.ok ? minutes.value : null,
    targetKm: km.ok ? km.value : null,
    note: form.note.trim(),
    createdAt: base.createdAt,
    updatedAt: now.toISOString(),
  });
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, errors: { name: parsed.errors.join(' ') } };
}

// --- Corsa fatta ---

export interface RunLogForm {
  date: string;
  minutes: string;
  seconds: string;
  distanceKm: string;
  rpe: number | null;
  note: string;
}

export type LogFieldErrors = Partial<Record<'date' | 'duration' | 'distanceKm' | 'rpe' | 'note', string>>;

export function emptyLogForm(date: string): RunLogForm {
  return { date, minutes: '', seconds: '', distanceKm: '', rpe: null, note: '' };
}

export function logToForm(log: RunLog): RunLogForm {
  return {
    date: log.date,
    minutes: String(Math.floor(log.durationSec / 60)),
    seconds: String(log.durationSec % 60).padStart(2, '0'),
    distanceKm: decimalText(log.distanceKm),
    rpe: log.rpe,
    note: log.note,
  };
}

/** Durata dai campi minuti e secondi; `null` se non valida o zero. */
export function formDurationSec(form: Pick<RunLogForm, 'minutes' | 'seconds'>): number | null {
  const read = (t: string) => (t.trim() === '' ? 0 : /^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN);
  const m = read(form.minutes);
  const s = read(form.seconds);
  if (!Number.isInteger(m) || !Number.isInteger(s) || s > 59) return null;
  const total = m * 60 + s;
  return total > 0 && total <= 24 * 3600 ? total : null;
}

/** Km dal campo (virgola o punto); `null` se vuoto o non valido. */
export function formDistanceKm(form: Pick<RunLogForm, 'distanceKm'>): number | null {
  const km = parseDecimalInput(form.distanceKm, { maxDecimals: 2 });
  return km.ok && km.value !== null && km.value >= 0.1 && km.value <= 500 ? km.value : null;
}

export type RunLogResult = { ok: true; value: RunLog } | { ok: false; errors: LogFieldErrors };

/** Modulo → corsa fatta. Data mai nel futuro, durata obbligatoria, RPE obbligatorio come nella sessione. */
export function formToLog(
  form: RunLogForm,
  base: { id: string; runId: string | null; runName: string; loggedAt: string },
  today: string,
): RunLogResult {
  const errors: LogFieldErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = 'Scegli la data.';
  else if (form.date > today) errors.date = 'La data non può essere nel futuro.';
  const durationSec = formDurationSec(form);
  if (durationSec === null) errors.duration = 'Scrivi la durata: minuti e secondi (da 0 a 59).';
  const km = parseDecimalInput(form.distanceKm, { maxDecimals: 2 });
  if (!km.ok) errors.distanceKm = km.error;
  else if (km.value !== null && (km.value < 0.1 || km.value > 500)) errors.distanceKm = 'Da 0,1 a 500 km.';
  if (form.rpe === null) errors.rpe = 'Scegli quanto è stata faticosa (RPE).';
  if (form.note.trim().length > MAX_TEXT.note) errors.note = `Al massimo ${MAX_TEXT.note} caratteri.`;
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = validate(runLogSchema, {
    id: base.id,
    runId: base.runId,
    runName: base.runName,
    date: form.date,
    loggedAt: base.loggedAt,
    durationSec,
    distanceKm: km.ok ? km.value : null,
    rpe: form.rpe,
    note: form.note.trim(),
  });
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, errors: { date: parsed.errors.join(' ') } };
}
