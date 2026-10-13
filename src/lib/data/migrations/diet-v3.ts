/**
 * Migrazione 2b: piano alimentare v3 con le varianti per tipo di giornata.
 * Funzioni pure sul JSON grezzo, **idempotenti**, senza perdita di dati. Le usano: DB v8 (`versions.ts`),
 * backup formato 2 → 3 (`backup-migrations.ts`), file piano v2 → v3 (`diet/import/detect.ts`).
 * La validazione completa con zod avviene dopo, sul risultato.
 */

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Giorno v2 `{ weekday, type, note, supplements, meals }` → giorno v3 con una sola variante
 * (`{ weekday, defaultType: type, variants: [{ type, note, supplements, meals }] }`). Un giorno già v3 resta com'è.
 * I campi mancanti restano mancanti (li completa zod con i suoi valori predefiniti).
 */
export function dietDayV2ToV3(day: unknown): unknown {
  if (!isRecord(day) || 'variants' in day) return day;
  const { type, note, supplements, meals, ...rest } = day;
  const variant: Raw = {};
  variant.type = type ?? null;
  if (note !== undefined) variant.note = note;
  if (supplements !== undefined) variant.supplements = supplements;
  variant.meals = meals;
  return { ...rest, defaultType: type ?? null, variants: [variant] };
}

/** Payload del piano (o file intero, stessi campi): ogni giorno diventa una variante sola. */
export function dietPayloadV2ToV3<T extends Raw>(payload: T): T {
  if (!Array.isArray(payload.days)) return payload;
  const days = payload.days.map(dietDayV2ToV3);
  return days.every((d, i) => d === (payload.days as unknown[])[i]) ? payload : { ...payload, days };
}

/** Riga di `dietPlans` (anche i piani archiviati). */
export function migrateDietPlanRow(row: unknown): unknown {
  if (!isRecord(row) || !isRecord(row.payload)) return row;
  const payload = dietPayloadV2ToV3(row.payload);
  return payload === row.payload ? row : { ...row, payload };
}

/**
 * Riga di `dietLog`: lo scambio "oggi seguo il piano di un altro giorno" (`swappedFromWeekday`) diventa la fonte dei
 * pasti fissata per quella data, con la variante predefinita di quel giorno: gli stessi pasti di prima.
 */
export function migrateDietLogRow(row: unknown): unknown {
  if (!isRecord(row) || !('swappedFromWeekday' in row)) return row;
  const { swappedFromWeekday, ...rest } = row;
  const mealsFrom = typeof swappedFromWeekday === 'number' ? { weekday: swappedFromWeekday, type: null } : null;
  return { ...rest, mealsFrom: 'mealsFrom' in rest ? rest.mealsFrom : mealsFrom };
}

/** File piano esteso v2 → v3 (§ 8.2). */
export function dietFileV2ToV3(raw: Raw): Raw {
  return { ...dietPayloadV2ToV3(raw), schemaVersion: 3 };
}

function mapRows(tables: Raw, name: string, fn: (row: unknown) => unknown): void {
  const rows = tables[name];
  if (Array.isArray(rows)) tables[name] = rows.map(fn);
}

/** Backup formato 2 → 3: piani con le varianti e diario con la fonte dei pasti. */
export function backupV2ToV3(data: Raw): Raw {
  const tables: Raw = isRecord(data.tables) ? { ...data.tables } : {};
  mapRows(tables, 'dietPlans', migrateDietPlanRow);
  mapRows(tables, 'dietLog', migrateDietLogRow);
  return { ...data, schemaVersion: 3, tables };
}
