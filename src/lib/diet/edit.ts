import { lookup } from '../data/errors';
import { defaultVariant } from './variants';
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
  if (!day) return next;
  // Tipo predefinito del giorno (2b). Una variante senza tipo (l'unica) prende lo stesso tipo; con più varianti
  // il predefinito si sceglie tra i tipi che il giorno ha già (le varianti arrivano solo dal file).
  if (day.variants.length === 1 && (day.variants[0]!.type === null || day.variants[0]!.type === day.defaultType)) {
    day.variants[0]!.type = typeKey;
    day.defaultType = typeKey;
  } else if (typeKey !== null && day.variants.some((v) => v.type === typeKey)) {
    day.defaultType = typeKey;
  }
  return next;
}

/** Tipi che si possono scegliere come predefiniti per un giorno: quelli delle sue varianti (con più varianti). */
export function selectableDayTypes(payload: DietPayload, weekday: number): string[] | null {
  const day = payload.days.find((d) => d.weekday === weekday);
  if (!day || day.variants.length === 1) return null;
  return day.variants.flatMap((v) => (v.type === null ? [] : [v.type]));
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

/** Integratori di una variante di un giorno (2b); `variantType` `null` = la variante predefinita. */
export function setSupplements(
  payload: DietPayload,
  weekday: number,
  supplements: DietSupplement[],
  variantType: string | null = null,
): DietPayload {
  const next = copy(payload);
  const day = next.days.find((d) => d.weekday === weekday);
  if (!day) return next;
  const variant = (variantType !== null && day.variants.find((v) => v.type === variantType)) || defaultVariant(day);
  variant.supplements = structuredClone(supplements);
  return next;
}
