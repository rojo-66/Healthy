import { formatNumber } from '../components/stepper';
import type { Run, RunLog } from '../data/schemas/runs';

/** Testi della corsa (2a). Il passo non si salva: si calcola da durata e distanza. */

const pad = (n: number) => String(n).padStart(2, '0');

/** Secondi per km; `null` senza distanza (o distanza non positiva). */
export function paceSecPerKm(durationSec: number, distanceKm: number | null): number | null {
  if (distanceKm === null || !(distanceKm > 0) || !(durationSec > 0)) return null;
  return durationSec / distanceKm;
}

/** "6:11 /km" (secondi arrotondati); "—" se non si può calcolare. */
export function paceLabel(durationSec: number, distanceKm: number | null, suffix = ' /km'): string {
  const pace = paceSecPerKm(durationSec, distanceKm);
  if (pace === null) return '—';
  const total = Math.round(pace);
  return `${Math.floor(total / 60)}:${pad(total % 60)}${suffix}`;
}

/** Durata "27:40", oltre l'ora "1:05:20". */
export function runDurationLabel(durationSec: number): string {
  const s = Math.max(0, Math.round(durationSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** "5,02 km". */
export function kmLabel(km: number): string {
  return `${formatNumber(km)} km`;
}

/** Obiettivo: "30′ · 5 km", "30′", "5 km"; "" se non c'è. */
export function targetLabel(run: Pick<Run, 'targetMinutes' | 'targetKm'>): string {
  const parts: string[] = [];
  if (run.targetMinutes !== null) parts.push(`${run.targetMinutes}′`);
  if (run.targetKm !== null) parts.push(kmLabel(run.targetKm));
  return parts.join(' · ');
}

/** Riga della corsa fatta: "27:40 · 5,02 km · 5:31/km · RPE 7". */
export function runLogLabel(log: Pick<RunLog, 'durationSec' | 'distanceKm' | 'rpe'>): string {
  const parts = [runDurationLabel(log.durationSec)];
  if (log.distanceKm !== null) {
    parts.push(kmLabel(log.distanceKm));
    parts.push(paceLabel(log.durationSec, log.distanceKm, '/km'));
  }
  if (log.rpe !== null) parts.push(`RPE ${log.rpe}`);
  return parts.join(' · ');
}

/** Durata prevista in minuti (orari, timeline): obiettivo in minuti, altrimenti ~6 min/km, altrimenti 30. */
export function runPlannedMinutes(run: Pick<Run, 'targetMinutes' | 'targetKm'>): number {
  if (run.targetMinutes !== null) return run.targetMinutes;
  if (run.targetKm !== null) return Math.max(1, Math.round(run.targetKm * 6));
  return 30;
}

/** Sigla della corsa nella striscia della settimana (prime 3 lettere senza accenti, come le schede). */
export function runTag(run: Pick<Run, 'name'>): string {
  const clean = run.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return clean.slice(0, 3) || 'RUN';
}
