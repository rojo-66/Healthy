import type { Result } from '../../data/errors';
import { MAX_BYTES } from '../../data/limits';
import { parseJsonText, parseWorkoutFile, readJsonFile, type FileLike } from '../../data/read-file';
import { APP_ID } from '../../data/schemas/common';
import type { WorkoutFile } from '../../data/schemas/workout-file';
import { parseDietImport, type DietImport } from '../../diet/import/detect';
import { MYDIET_APP } from '../../diet/import/mydiet-schema';
import { decodePayload } from '../codec';
import { extractImport } from './entry';

/** Contenuto ricevuto, già validato: una scheda (§ 8.1) o un piano alimentare (§ 8.2, anche MyDiet). */
export type SharedContent = { kind: 'workout'; file: WorkoutFile } | { kind: 'diet'; imp: DietImport };

const fail = (message: string): { ok: false; errors: string[] } => ({ ok: false, errors: [message] });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const BACKUP_REJECTED = 'È un backup completo, non una scheda né una dieta: si ripristina da Profilo › Backup e dati.';
export const SESSION_REJECTED =
  'È il resoconto di un allenamento (Invia al PT): non è una scheda e in questa versione non si importa.';

/**
 * Riconosce il tipo **dal contenuto** (`app`, `kind`, `schemaVersion`) e valida tutto con zod.
 * Solo schede e diete: backup e sessioni sono rifiutati con un messaggio che dice cosa sono. Non lancia mai.
 */
export function detectShared(raw: unknown): Result<SharedContent> {
  if (!isRecord(raw)) return fail('Il contenuto non è una scheda né un piano alimentare di Healthy.');
  if (raw.app === MYDIET_APP) {
    const diet = parseDietImport(raw);
    return diet.ok ? { ok: true, value: { kind: 'diet', imp: diet.value } } : diet;
  }
  if (raw.app !== APP_ID) return fail('Questo contenuto non è stato creato da Healthy (né da MyDiet).');
  switch (raw.kind) {
    case 'workout': {
      const workout = parseWorkoutFile(raw);
      return workout.ok ? { ok: true, value: { kind: 'workout', file: workout.value } } : workout;
    }
    case 'diet': {
      const diet = parseDietImport(raw);
      return diet.ok ? { ok: true, value: { kind: 'diet', imp: diet.value } } : diet;
    }
    case 'backup':
      return fail(BACKUP_REJECTED);
    case 'session':
      return fail(SESSION_REJECTED);
    default:
      return fail('Tipo di contenuto sconosciuto: qui si importano solo schede e piani alimentari.');
  }
}

/** Testo incollato (link, codice o JSON) → contenuto validato. */
export function readSharedText(input: string): Result<SharedContent> {
  const extracted = extractImport(input);
  if (!extracted.ok) return fail(extracted.error);
  if (extracted.value.type === 'payload') {
    const decoded = decodePayload(extracted.value.payload);
    return decoded.ok ? detectShared(decoded.value) : decoded;
  }
  const { text } = extracted.value;
  if (text.length > MAX_BYTES.share) return fail('Il testo incollato è troppo lungo per una scheda o una dieta.');
  const json = parseJsonText(text, 'Il testo incollato non è un JSON valido: forse è incompleto.', 'Il testo');
  return json.ok ? detectShared(json.value) : json;
}

/** Payload arrivato da un link (`#import=…`) → contenuto validato. */
export function readSharedPayload(payload: string): Result<SharedContent> {
  const decoded = decodePayload(payload);
  return decoded.ok ? detectShared(decoded.value) : decoded;
}

/** File `.json` scelto dall'utente (dimensione controllata prima di leggerlo). */
export async function readSharedFile(file: FileLike): Promise<Result<SharedContent>> {
  const json = await readJsonFile(file, MAX_BYTES.share, { unwrap: true });
  return json.ok ? detectShared(json.value) : json;
}
