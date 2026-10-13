/**
 * Migrazione 2c: calendario delle attività (spostamenti, salti, dieta scelta per data) e tipo di giornata automatico.
 * Funzioni pure sul JSON grezzo, **idempotenti**, senza perdita di dati. Le usano: DB v9 (`versions.ts`) e
 * backup formato 3 → 4 (`backup-migrations.ts`). La validazione completa con zod avviene dopo, sul risultato.
 */

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Giorno della settimana (1 = lunedì) di una data `AAAA-MM-GG`; `null` se non è una data. */
function weekdayOfDate(date: unknown): number | null {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getDay();
  return day === 0 ? 7 : day;
}

/**
 * Riga di `dietLog`: ogni pasto già spuntato riceve la sua fonte, cioè i pasti che si vedevano quando è stato segnato
 * (lo scambio del giorno, se c'era, altrimenti la variante predefinita di quel giorno). Così, anche quando il tipo di
 * giornata cambia, le spunte di prima restano identiche.
 */
export function migrateDietLogRowV4(row: unknown): unknown {
  if (!isRecord(row) || 'mealSources' in row) return row;
  const weekday = weekdayOfDate(row.date);
  const from = isRecord(row.mealsFrom) ? row.mealsFrom : weekday === null ? null : { weekday, type: null };
  const mealSources: Raw = {};
  if (from && isRecord(row.eaten)) {
    for (const [key, eaten] of Object.entries(row.eaten)) if (eaten === true) mealSources[key] = { ...from };
  }
  return { ...row, mealSources };
}

/** Impostazione `calendarStart`: da quel giorno il tipo di giornata viene dalle attività (prima resta quello del piano). */
export function calendarStartSetting(date: string): Raw {
  return { key: 'calendarStart', value: date };
}

function mapRows(tables: Raw, name: string, fn: (row: unknown) => unknown): void {
  const rows = tables[name];
  if (Array.isArray(rows)) tables[name] = rows.map(fn);
}

/**
 * Backup formato 3 → 4: tabelle nuove vuote, diario con la fonte dei pasti spuntati, inizio del calendario = giorno
 * del backup (i dati del backup sono tutti di prima del 2c).
 */
export function backupV3ToV4(data: Raw): Raw {
  const tables: Raw = isRecord(data.tables) ? { ...data.tables } : {};
  mapRows(tables, 'dietLog', migrateDietLogRowV4);
  if (!('calendarEdits' in tables)) tables.calendarEdits = [];
  if (!('dayChoices' in tables)) tables.dayChoices = [];
  const counts: Raw = isRecord(data.counts) ? { ...data.counts } : {};
  if (!('calendarEdits' in counts)) counts.calendarEdits = 0;
  if (!('dayChoices' in counts)) counts.dayChoices = 0;

  const created = typeof data.createdAt === 'string' ? new Date(data.createdAt) : null;
  if (created && !Number.isNaN(created.getTime()) && Array.isArray(tables.settings)) {
    const settings = tables.settings as unknown[];
    if (!settings.some((s) => isRecord(s) && s.key === 'calendarStart')) {
      tables.settings = [...settings, calendarStartSetting(localIsoDate(created))];
      if (typeof counts.settings === 'number') counts.settings = counts.settings + 1;
    }
  }
  return { ...data, schemaVersion: 4, counts, tables };
}

/** Giorno locale `AAAA-MM-GG` (come `toIsoDate`, senza dipendenze: il modulo resta puro). */
export function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
