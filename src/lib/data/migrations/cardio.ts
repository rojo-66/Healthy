import { contentHash, hashOf, type ShareableWorkoutContent } from '../../share/workout-content';
import { findCardioEntry } from '../../workouts/library/cardio';

/**
 * Migrazione 2a: il "cardio finale" diventa un esercizio cardio, gli esercizi hanno un tipo.
 * Funzioni pure sul JSON grezzo (righe del database, backup, file condivisi, bozza dell'editor),
 * **idempotenti** (una riga già migrata resta uguale) e senza perdita di dati. Le usano:
 * DB v7 (`versions.ts`), backup formato 1 → 2 (`backup-migrations.ts`), file scheda v1 → v2 (`read-file.ts`).
 * La validazione completa con zod avviene dopo, sul risultato.
 */

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptyCardioFields() {
  return { distanceKm: null, speedKmh: null, inclinePct: null, level: null };
}

/** Il vecchio `cardio { type, minutes }` collegato alla libreria per nome; se non c'è, resta il nome scritto. */
function legacyCardio(cardio: Raw): { exerciseId: string | null; name: string; minutes: unknown; fields: string[] } {
  const type = typeof cardio.type === 'string' ? cardio.type.trim() : '';
  const entry = type ? findCardioEntry(type) : null;
  return {
    exerciseId: entry?.id ?? null,
    name: entry?.name ?? type,
    minutes: cardio.minutes,
    fields: entry ? [...entry.fields] : [],
  };
}

/** Elemento della scheda senza `kind` (prima del 2a) = esercizio di forza. */
function withKind(item: unknown): unknown {
  if (!isRecord(item) || 'kind' in item) return item;
  return { kind: 'strength', ...item };
}

/** Elemento cardio per la scheda salvata (o per la copia della scheda in una sessione). */
function cardioItem(cardio: Raw): Raw {
  const c = legacyCardio(cardio);
  return { kind: 'cardio', exerciseId: c.exerciseId, name: c.name, minutes: c.minutes, ...emptyCardioFields(), note: '', videoUrl: null };
}

/**
 * Impronta del contenuto condivisibile **come era prima del 2a** (lista bianca M8, con `cardio`).
 * Serve solo a capire se una scheda ricevuta era ancora intatta (`received.hash`).
 */
export function legacyContentHashV1(w: Raw): string {
  const items = Array.isArray(w.items) ? w.items.filter(isRecord) : [];
  const cardio = isRecord(w.cardio) ? { type: w.cardio.type, minutes: w.cardio.minutes } : null;
  return hashOf({
    name: w.name,
    weekdays: Array.isArray(w.weekdays) ? [...(w.weekdays as number[])].sort((a, b) => a - b) : w.weekdays,
    time: w.time,
    intro: w.intro,
    warmup: Array.isArray(w.warmup) ? w.warmup.filter(isRecord).map((x) => ({ name: x.name, hint: x.hint, dose: x.dose })) : w.warmup,
    items: items.map((i) => ({
      name: i.name,
      muscles: Array.isArray(i.muscles) ? [...i.muscles] : i.muscles,
      sets: i.sets,
      reps: i.reps,
      kg: i.kg,
      restSec: i.restSec,
      note: i.note,
      videoUrl: i.videoUrl,
      setsDetail: Array.isArray(i.setsDetail) ? i.setsDetail.filter(isRecord).map((s) => ({ reps: s.reps, kg: s.kg })) : null,
    })),
    cardio,
  });
}

function needsWorkoutMigration(w: Raw): boolean {
  return 'cardio' in w || (Array.isArray(w.items) && w.items.some((i) => isRecord(i) && !('kind' in i)));
}

/** Una versione di scheda (anche quelle in `previousVersions`). */
function migrateWorkoutVersion(w: unknown): unknown {
  if (!isRecord(w) || !needsWorkoutMigration(w)) return w;
  const { cardio, ...rest } = w;
  const items = Array.isArray(w.items) ? w.items.map(withKind) : w.items;
  if (Array.isArray(items) && isRecord(cardio)) items.push(cardioItem(cardio));
  const next: Raw = { ...rest, items };
  // Scheda ricevuta e intatta: l'impronta va ricalcolata sul formato nuovo, altrimenti risulterebbe "modificata qui".
  // Se era già modificata (impronta diversa), resta com'è e la scheda continua a risultare modificata.
  if (isRecord(w.received) && w.received.hash === legacyContentHashV1(w)) {
    try {
      next.received = { ...w.received, hash: contentHash(next as unknown as ShareableWorkoutContent) };
    } catch {
      // Contenuto non valido: lo segnalerà la validazione.
    }
  }
  return next;
}

/** Riga di `workouts`: la scheda e la sua cronologia. */
export function migrateWorkoutRow(row: unknown): unknown {
  const w = migrateWorkoutVersion(row);
  if (!isRecord(w) || !Array.isArray(w.previousVersions)) return w;
  const previous = w.previousVersions.map(migrateWorkoutVersion);
  return previous.every((p, i) => p === (w.previousVersions as unknown[])[i]) ? w : { ...w, previousVersions: previous };
}

/** Esercizio della libreria o personalizzato senza tipo (prima del 2a) = forza. */
export function migrateExerciseRow(row: unknown): unknown {
  if (!isRecord(row) || 'kind' in row) return row;
  return { ...row, kind: 'strength', cardioFields: [] };
}

/** Copia della scheda di una sessione vecchia senza `snapshot` (prima di M5): stessa regola di `sessionItems()`. */
function rebuildSnapshotItems(sets: readonly Raw[]): Raw[] {
  const byIndex = new Map<number, { exerciseId: unknown; count: number; kg: unknown; reps: unknown }>();
  for (const set of sets) {
    const index = Number(set.itemIndex);
    const setIndex = Number(set.setIndex);
    const entry = byIndex.get(index);
    if (entry) entry.count = Math.max(entry.count, setIndex + 1);
    else byIndex.set(index, { exerciseId: set.exerciseId ?? null, count: setIndex + 1, kg: set.kg, reps: set.reps });
  }
  const max = Math.max(-1, ...byIndex.keys());
  const items: Raw[] = [];
  for (let i = 0; i <= max; i++) {
    const entry = byIndex.get(i);
    items.push({
      kind: 'strength',
      exerciseId: entry?.exerciseId ?? null,
      name: `Esercizio ${i + 1}`,
      muscles: [],
      sets: Math.max(1, entry?.count ?? 1),
      reps: entry?.reps ?? 0,
      kg: entry?.kg ?? 0,
      restSec: 90,
      note: '',
      videoUrl: null,
      setsDetail: null,
    });
  }
  return items;
}

function needsSessionMigration(s: Raw): boolean {
  if ('cardioDone' in s || !Array.isArray(s.cardio)) return true;
  const snap = s.snapshot;
  return isRecord(snap) && ('cardio' in snap || (Array.isArray(snap.items) && snap.items.some((i) => isRecord(i) && !('kind' in i))));
}

/**
 * Riga di `sessions`: il cardio della copia della scheda diventa un esercizio in fondo, `cardioDone` diventa
 * la sua voce in `cardio` (fatto, minuti, km). Una sessione in corso resta valida: `live.itemIndex` non cambia.
 */
export function migrateSessionRow(row: unknown): unknown {
  if (!isRecord(row) || !needsSessionMigration(row)) return row;
  const { cardioDone, ...rest } = row;
  const done = isRecord(cardioDone) ? cardioDone : null;
  const entries: Raw[] = Array.isArray(row.cardio) ? [...(row.cardio as Raw[])] : [];
  let snapshot: unknown = row.snapshot ?? null;

  if (isRecord(snapshot)) {
    const { cardio, ...snap } = snapshot;
    const items = Array.isArray(snap.items) ? snap.items.map(withKind) : [];
    // Cardio previsto nella scheda; se manca ma risulta fatto (dati incoerenti), vale quello fatto.
    const planned = isRecord(cardio) ? cardio : done ? { type: done.type, minutes: Math.round(Number(done.minutes) || 0) } : null;
    if (planned) {
      items.push(cardioItem(planned));
      entries.push(cardioEntry(items.length - 1, done));
    }
    snapshot = { ...snap, items };
  } else if (done) {
    const sets = Array.isArray(row.sets) ? row.sets.filter(isRecord) : [];
    const items = rebuildSnapshotItems(sets);
    items.push(cardioItem({ type: done.type, minutes: Math.round(Number(done.minutes) || 0) }));
    entries.push(cardioEntry(items.length - 1, done));
    snapshot = { items };
  }

  return { ...rest, cardio: entries, snapshot };
}

function cardioEntry(itemIndex: number, done: Raw | null): Raw {
  return {
    itemIndex,
    minutes: done ? (done.minutes ?? null) : null,
    distanceKm: done ? (done.distanceKm ?? null) : null,
    done: done !== null,
    clock: { runningSince: null, elapsedMs: 0 },
  };
}

/** Valore di `settings.workoutDraft` (`{ savedAt, draft }`): stessa conversione della scheda, con le chiavi di riga. */
export function migrateSavedDraft(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.draft)) return value;
  const draft = value.draft;
  const hasLegacyItems = Array.isArray(draft.items) && draft.items.some((i) => isRecord(i) && !('kind' in i));
  if (!('cardio' in draft) && !hasLegacyItems) return value;
  const { cardio, ...rest } = draft;
  const items = Array.isArray(draft.items) ? draft.items.map(withKind) : [];
  if (isRecord(cardio)) {
    const c = legacyCardio(cardio);
    items.push({
      kind: 'cardio',
      key: `cardio-${items.length}`,
      exerciseId: c.exerciseId,
      name: c.name,
      minutes: c.minutes,
      ...emptyCardioFields(),
      note: '',
      videoUrl: '',
      fields: c.fields,
    });
  }
  return { ...value, draft: { ...rest, items } };
}

/** Riga di `settings`: solo la bozza dell'editor cambia. */
export function migrateSettingRow(row: unknown): unknown {
  if (!isRecord(row) || row.key !== 'workoutDraft') return row;
  const value = migrateSavedDraft(row.value);
  return value === row.value ? row : { ...row, value };
}

/** File scheda condiviso v1 → v2 (§ 8.1): `items[]` con `kind`, il cardio in fondo. */
export function workoutFileV1ToV2(raw: Raw): Raw {
  const { cardio, ...rest } = raw;
  const items = Array.isArray(raw.items) ? raw.items.map(withKind) : raw.items;
  if (Array.isArray(items) && isRecord(cardio)) {
    const c = legacyCardio(cardio);
    items.push({ kind: 'cardio', name: c.name, minutes: c.minutes, ...emptyCardioFields(), note: '', videoUrl: null });
  }
  return { ...rest, schemaVersion: 2, items };
}

function mapRows(tables: Raw, name: string, fn: (row: unknown) => unknown): void {
  const rows = tables[name];
  if (Array.isArray(rows)) tables[name] = rows.map(fn);
}

/** Backup formato 1 → 2: righe migrate come nel database e tabelle nuove (`runs`, `runLogs`) vuote. */
export function backupV1ToV2(data: Raw): Raw {
  const tables: Raw = isRecord(data.tables) ? { ...data.tables } : {};
  mapRows(tables, 'exercises', migrateExerciseRow);
  mapRows(tables, 'workouts', migrateWorkoutRow);
  mapRows(tables, 'sessions', migrateSessionRow);
  mapRows(tables, 'settings', migrateSettingRow);
  if (!('runs' in tables)) tables.runs = [];
  if (!('runLogs' in tables)) tables.runLogs = [];
  const counts: Raw = isRecord(data.counts) ? { ...data.counts } : {};
  if (!('runs' in counts)) counts.runs = 0;
  if (!('runLogs' in counts)) counts.runLogs = 0;
  return { ...data, schemaVersion: 2, counts, tables };
}
