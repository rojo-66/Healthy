import { lookup } from '../data/errors';
import type {
  DietNutrients,
  DietPayload,
  DietSupplement,
  DietTargets,
  TargetsSource,
} from '../data/schemas/diet-payload';

/**
 * Modifiche del completamento guidato (M3: solo dati mancanti, niente pasti o grammi).
 * Funzioni pure: restituiscono un nuovo piano, la validazione avviene al salvataggio.
 */

/** Tipi di giornata predefiniti: chiavi con un colore fisso (magenta, ciano, grigio). */
export const DAY_TYPE_PRESETS = [
  { key: 'gym', label: 'Palestra' },
  { key: 'run', label: 'Corsa' },
  { key: 'rest', label: 'Riposo' },
] as const;

export type DayTypePresetKey = (typeof DAY_TYPE_PRESETS)[number]['key'];

/**
 * Numero scritto a mano, con la virgola o il punto: "26,9" → 26.9; vuoto → `null`; altro → `NaN`.
 * I limiti (es. kcal ≥ 0) li controlla lo schema al salvataggio.
 */
export function parseNumberInput(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (clean === '') return null;
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

/** Numero da mettere in un campo: 26.9 → "26,9", `null` → "". */
export function numberToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).replace('.', ',');
}

function copy(payload: DietPayload): DietPayload {
  return structuredClone(payload);
}

/** Valori per 100 g (e grammi per pezzo) di un prodotto. */
export function setProductValues(
  payload: DietPayload,
  key: string,
  per100: DietNutrients | null,
  pieceGrams: number | null,
): DietPayload {
  const next = copy(payload);
  const product = lookup(next.products, key);
  if (!product) return next;
  product.per100 = per100;
  product.pieceGrams = pieceGrams;
  return next;
}

/** Tipo di giornata di un giorno (crea il tipo predefinito se manca). */
export function setDayType(payload: DietPayload, weekday: number, typeKey: string | null): DietPayload {
  const next = copy(payload);
  if (typeKey !== null && !lookup(next.dayTypes, typeKey)) {
    const preset = DAY_TYPE_PRESETS.find((p) => p.key === typeKey);
    next.dayTypes[typeKey] = { label: preset?.label ?? typeKey, targets: null, targetsSource: 'manual' };
  }
  const day = next.days.find((d) => d.weekday === weekday);
  if (day) day.type = typeKey;
  return next;
}

/** Target di un tipo di giornata, con la loro origine (inseriti a mano o stima accettata). */
export function setTargets(
  payload: DietPayload,
  typeKey: string,
  targets: DietTargets | null,
  source: Exclude<TargetsSource, 'plan'>,
): DietPayload {
  const next = copy(payload);
  const dayType = lookup(next.dayTypes, typeKey);
  if (!dayType) return next;
  dayType.targets = targets;
  dayType.targetsSource = source;
  return next;
}

/** Integratori di un giorno. */
export function setSupplements(payload: DietPayload, weekday: number, supplements: DietSupplement[]): DietPayload {
  const next = copy(payload);
  const day = next.days.find((d) => d.weekday === weekday);
  if (day) day.supplements = structuredClone(supplements);
  return next;
}
