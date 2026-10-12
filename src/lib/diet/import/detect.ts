import { validate, type Result } from '../../data/errors';
import { MAX_BYTES } from '../../data/limits';
import { checkEnvelope, parseDietFile, readJsonFile, type FileLike } from '../../data/read-file';
import { APP_ID } from '../../data/schemas/common';
import { DIET_FILE_KIND, DIET_FILE_VERSION, dietFileSchema, type DietFile } from '../../data/schemas/diet-file';
import type { DietPlanOrigin } from '../../data/schemas/diet-plans';
import { convertMyDiet } from './mydiet-adapter';
import { MYDIET_APP, MYDIET_VERSION, myDietFileSchema } from './mydiet-schema';
import { normalizeExtendedDiet, type NormalizeOptions } from './tolerant';

/** Piano letto da un file, già validato e nel formato esteso. */
export interface DietImport {
  file: DietFile;
  origin: DietPlanOrigin;
  /** Avvisi della conversione (orari ignorati, giorni mancanti…). */
  warnings: string[];
}

const fail = (errors: string[]): { ok: false; errors: string[] } => ({ ok: false, errors });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const defaultOptions = (): NormalizeOptions => ({ today: new Date(), newId: () => crypto.randomUUID() });

/**
 * Riconosce il tipo di file dal contenuto: piano esteso di Healthy (§ 8.2) o file di MyDiet (§ 8.3).
 * Tutto passa da zod; il file MyDiet è validato due volte (com'è arrivato e dopo la conversione).
 * Il piano esteso passa prima dalla normalizzazione dei file nati dal modello per Claude. Non lancia mai.
 */
export function parseDietImport(raw: unknown, options: NormalizeOptions = defaultOptions()): Result<DietImport> {
  if (!isRecord(raw)) return fail(['Il file non contiene un piano alimentare.']);

  if (raw.app === MYDIET_APP) {
    if (raw.schemaVersion !== MYDIET_VERSION) {
      return fail([
        `È un file di MyDiet in un formato che questa app non conosce (formato ${String(raw.schemaVersion)}, questa app legge il ${MYDIET_VERSION}).`,
      ]);
    }
    const source = validate(myDietFileSchema, raw);
    if (!source.ok) return source;
    const { draft, warnings } = convertMyDiet(source.value);
    const converted = validate(dietFileSchema, draft);
    if (!converted.ok) return converted;
    return { ok: true, value: { file: converted.value, origin: 'mydiet', warnings } };
  }

  if (raw.app !== APP_ID) return fail(['Questo file non è un piano alimentare di Healthy né di MyDiet.']);
  const envelope = checkEnvelope(raw, DIET_FILE_KIND, DIET_FILE_VERSION);
  if (!envelope.ok) return envelope;
  const normalized = normalizeExtendedDiet(raw, options);
  if (normalized.errors.length > 0) return fail(normalized.errors);
  const extended = parseDietFile(normalized.raw);
  if (!extended.ok) return extended;
  return { ok: true, value: { file: extended.value, origin: 'file', warnings: normalized.warnings } };
}

/** Legge (con il limite di dimensione, prima di leggere) e riconosce un piano da file. */
export async function readDietImport(file: FileLike): Promise<Result<DietImport>> {
  const json = await readJsonFile(file, MAX_BYTES.share, { unwrap: true });
  return json.ok ? parseDietImport(json.value) : json;
}
