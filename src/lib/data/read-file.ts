import { lookup, validate, type Result } from './errors';
import { diagnoseJsonSyntax, unwrapJson } from './json-text';
import { MAX_BYTES } from './limits';
import { workoutFileV1ToV2 } from './migrations/cardio';
import { dietFileV2ToV3 } from './migrations/diet-v3';
import { APP_ID } from './schemas/common';
import { DIET_FILE_KIND, DIET_FILE_VERSION, dietFileSchema, type DietFile } from './schemas/diet-file';
import { WORKOUT_FILE_KIND, WORKOUT_FILE_VERSION, workoutFileSchema, type WorkoutFile } from './schemas/workout-file';

/** Quel che serve di un `File`: permette di testare con oggetti finti. */
export interface FileLike {
  readonly size: number;
  text(): Promise<string>;
}

const fail = (message: string): { ok: false; errors: string[] } => ({ ok: false, errors: [message] });

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
}

export interface ReadJsonOptions {
  /** Toglie il testo attorno al JSON (blocchi ```json, frasi prima e dopo): file nati in una chat. */
  unwrap?: boolean;
}

/**
 * Legge un file JSON scelto dall'utente. Controlla la dimensione **prima** di leggerlo,
 * così un file enorme non blocca il telefono. Non lancia mai.
 */
export async function readJsonFile(file: FileLike, maxBytes: number, options: ReadJsonOptions = {}): Promise<Result<unknown>> {
  if (file.size === 0) return fail('Il file è vuoto.');
  if (file.size > maxBytes) {
    return fail(`Il file è troppo grande (${formatMb(file.size)}): il massimo è ${formatMb(maxBytes)}.`);
  }
  let content: string;
  try {
    content = await file.text();
  } catch {
    return fail('Impossibile leggere il file.');
  }
  // La dimensione dichiarata potrebbe non corrispondere al contenuto.
  if (content.length > maxBytes) return fail(`Il file è troppo grande: il massimo è ${formatMb(maxBytes)}.`);
  if (options.unwrap) content = unwrapJson(content).text;
  return parseJsonText(content, 'Il file non è un JSON valido: forse è danneggiato o non è un file di Healthy.', 'Il file');
}

/**
 * `JSON.parse` che non lancia mai e rifiuta `__proto__` (file, link, testo incollato).
 * `invalidMessage` è l'errore da mostrare se il testo non è JSON; `what` apre il messaggio sulla chiave vietata.
 */
export function parseJsonText(content: string, invalidMessage: string, what = 'Il contenuto'): Result<unknown> {
  let value: unknown;
  let forbiddenKey = false;
  try {
    value = JSON.parse(content, (key, inner: unknown) => {
      // zod scarterebbe "__proto__" in silenzio: un file che lo contiene è sospetto, meglio rifiutarlo.
      if (key === '__proto__') forbiddenKey = true;
      return inner;
    });
  } catch {
    // Errori tipici (virgole finali, decimali con la virgola, commenti) spiegati con la riga.
    return { ok: false, errors: [invalidMessage, ...diagnoseJsonSyntax(content)] };
  }
  if (forbiddenKey) return fail(`${what} contiene una chiave non ammessa («__proto__»).`);
  return { ok: true, value };
}

const KIND_NAMES: Readonly<Record<string, string>> = {
  workout: 'una scheda',
  diet: 'un piano alimentare',
  backup: 'un backup',
  session: 'il resoconto di un allenamento',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Controlla `app`, `kind` e `schemaVersion` con messaggi mirati, prima della validazione completa.
 * Restituisce la `schemaVersion` del file (può essere più vecchia di `current`: la migrazione è del chiamante).
 */
export function checkEnvelope(raw: unknown, kind: string, current: number): Result<number> {
  const what = lookup(KIND_NAMES, kind) ?? 'un file';
  if (!isRecord(raw)) return fail('Il file non contiene dati di Healthy.');
  if (raw.app !== APP_ID) {
    if (raw.app === 'dieta-e-spesa') return fail('È un file di MyDiet: si importa dalla sezione Dieta.');
    return fail('Questo file non è stato creato da Healthy.');
  }
  if (raw.kind !== kind) {
    const actual = typeof raw.kind === 'string' ? lookup(KIND_NAMES, raw.kind) : undefined;
    return fail(actual ? `Questo file è ${actual}, non ${what}.` : 'Tipo di file sconosciuto.');
  }
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return fail('Versione del formato mancante o non valida.');
  }
  if (version > current) {
    return fail(
      `Questo file è ${what} creato con una versione più recente dell'app (formato ${version}, questa app legge fino al ${current}): aggiorna Healthy e riprova.`,
    );
  }
  return { ok: true, value: version };
}

/** Scheda condivisa (SPEC § 8.1). La v1 (con il "cardio finale", prima del 2a) viene convertita nella v2. */
export function parseWorkoutFile(raw: unknown): Result<WorkoutFile> {
  const envelope = checkEnvelope(raw, WORKOUT_FILE_KIND, WORKOUT_FILE_VERSION);
  if (!envelope.ok) return envelope;
  if (envelope.value === 1) return validate(workoutFileSchema, workoutFileV1ToV2(raw as Record<string, unknown>));
  if (envelope.value !== WORKOUT_FILE_VERSION) return fail(`Formato ${envelope.value} non supportato.`);
  return validate(workoutFileSchema, raw);
}

/** Piano alimentare esteso (SPEC § 8.2). La v2 (un menu per giorno, prima del 2b) viene convertita nella v3. */
export function parseDietFile(raw: unknown): Result<DietFile> {
  const envelope = checkEnvelope(raw, DIET_FILE_KIND, DIET_FILE_VERSION);
  if (!envelope.ok) return envelope;
  if (envelope.value === 2) return validate(dietFileSchema, dietFileV2ToV3(raw as Record<string, unknown>));
  if (envelope.value !== DIET_FILE_VERSION) return fail(`Formato ${envelope.value} non supportato.`);
  return validate(dietFileSchema, raw);
}

/** Legge e valida una scheda da file. */
export async function readWorkoutFile(file: FileLike): Promise<Result<WorkoutFile>> {
  const json = await readJsonFile(file, MAX_BYTES.share);
  return json.ok ? parseWorkoutFile(json.value) : json;
}

/** Legge e valida un piano alimentare da file. */
export async function readDietFile(file: FileLike): Promise<Result<DietFile>> {
  const json = await readJsonFile(file, MAX_BYTES.share);
  return json.ok ? parseDietFile(json.value) : json;
}
