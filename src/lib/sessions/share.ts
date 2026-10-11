import { formatClock } from '../components/time';
import { parseOrThrow } from '../data/errors';
import { nowIso } from '../data/ids';
import { APP_ID } from '../data/schemas/common';
import { SESSION_FILE_KIND, SESSION_FILE_VERSION, sessionFileSchema, type SessionFile } from '../data/schemas/session-file';
import type { Session } from '../data/schemas/sessions';
import { headerDate, toIsoDate } from '../diet/calc/calendar';
import { setLabel, timeRange, volumeLabel } from './format';
import { normalizeName } from './items';
import { READINESS_ITEMS } from './readiness';
import type { SessionSummary } from './summary';

/** "Lun 12 ott 2026" */
function dayLabel(iso: string): string {
  const s = headerDate(new Date(iso)).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Riepilogo in testo semplice per il PT (foglio di condivisione, appunti). Solo testo: nessun HTML.
 */
export function sessionText(session: Session, summary: SessionSummary): string {
  const lines: string[] = [];
  lines.push(`${session.workoutName} · v${session.workoutVersion}`);
  lines.push(`${dayLabel(session.startedAt)} · ${timeRange(session.startedAt, session.endedAt)} (${formatClock(summary.durationSec)})`);
  if (session.readiness && summary.readinessTotal !== null) {
    const parts = READINESS_ITEMS.map((i) => `${i.short.toLowerCase()} ${session.readiness?.[i.key]}`);
    lines.push(`Readiness ${summary.readinessTotal}/25 (${parts.join(', ')})`);
  }
  const head = [`Volume ${volumeLabel(summary.volume)}`, `Serie ${summary.done}/${summary.planned}`];
  if (summary.records > 0) head.push(`Record ${summary.records}`);
  if (session.rpe !== null) head.push(`RPE ${session.rpe}/10`);
  lines.push(head.join(' · '));

  for (const e of summary.exercises) {
    lines.push('');
    const best = e.best ? ` · top ${setLabel(e.best.kg, e.best.reps)}` : '';
    lines.push(`${e.index + 1}. ${e.name} — ${e.done}/${e.planned}${best}${e.pr ? ' · PR' : ''}`);
    if (e.sets.length > 0) lines.push(`   ${e.sets.map((s) => (s.extra ? `${s.text} (in più)` : s.text)).join(' · ')}`);
    if (e.note) lines.push(`   Nota: ${e.note}`);
  }
  if (summary.cardio) {
    lines.push('');
    lines.push(`Cardio: ${summary.cardio.type} ${summary.cardio.minutes}’ ${summary.cardio.done ? '✓' : '· non fatto'}`);
  }
  return lines.join('\n');
}

/** File `.json` della sessione (SPEC § 8, `kind: "session"`), validato prima della consegna. */
export function sessionToFile(session: Session, now: Date = new Date()): SessionFile {
  return parseOrThrow(sessionFileSchema, {
    app: APP_ID,
    kind: SESSION_FILE_KIND,
    schemaVersion: SESSION_FILE_VERSION,
    exportedAt: nowIso(now),
    session: { ...session, live: null },
  });
}

/** "healthy-sessione-petto-schiena-2026-10-12.json". */
export function sessionFileName(session: Pick<Session, 'workoutName' | 'startedAt'>): string {
  const slug = normalizeName(session.workoutName)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `healthy-sessione-${slug || 'allenamento'}-${toIsoDate(new Date(session.startedAt))}.json`;
}

export function sessionExportFile(session: Session, now: Date = new Date()): File {
  return new File([JSON.stringify(sessionToFile(session, now), null, 2)], sessionFileName(session), {
    type: 'application/json',
  });
}

export type ShareOutcome =
  /** Foglio di condivisione aperto e usato (con il file, o solo il testo). */
  | 'shared-file'
  | 'shared-text'
  /** L'utente ha chiuso il foglio. */
  | 'cancelled'
  /** Safari ha "consumato" il gesto: serve un nuovo tocco. */
  | 'needs-gesture'
  /** Niente Web Share: si mostrano "Copia testo" e "Scarica il file". */
  | 'unsupported';

export interface ShareEnv {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

function errorName(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string' ? error.name : null;
}

/**
 * "Invia al PT": foglio di condivisione di iOS con testo e file `.json`; se il file non si può condividere,
 * solo il testo. Mai un invio automatico: sceglie sempre l'utente. Il file va preparato prima del tocco.
 */
export async function shareSession(
  data: { title: string; text: string; file: File },
  env: ShareEnv = navigator as ShareEnv,
): Promise<ShareOutcome> {
  if (!env.share) return 'unsupported';
  let withFile = false;
  try {
    withFile = env.canShare?.call(env, { files: [data.file] }) ?? false;
  } catch {
    withFile = false;
  }
  try {
    if (withFile) await env.share.call(env, { title: data.title, text: data.text, files: [data.file] });
    else await env.share.call(env, { title: data.title, text: data.text });
    return withFile ? 'shared-file' : 'shared-text';
  } catch (error) {
    const name = errorName(error);
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError') return 'needs-gesture';
    return 'unsupported';
  }
}
