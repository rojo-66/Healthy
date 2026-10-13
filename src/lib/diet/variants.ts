import type { MealsFrom } from '../data/schemas/diet-log';
import type { DietDay, DietPayload, DietPlanDay, DietVariant } from '../data/schemas/diet-payload';

/**
 * Varianti dei giorni del piano (2b, formato v3): quale variante si segue in una data.
 * Un solo punto di scelta, funzione pura: Dieta, Home, Progressi, spesa e "prossimo pasto" passano da qui.
 */

/**
 * Come è stata scelta la variante:
 * - `none`: il giorno ha la variante del tipo richiesto;
 * - `other-day`: non ce l'ha, si usa la stessa variante del giorno più vicino che ce l'ha ("pasti di giovedì");
 * - `no-variant`: nessun giorno ce l'ha: restano i pasti della variante predefinita, i target sono del tipo richiesto.
 */
export type VariantFallback = 'none' | 'other-day' | 'no-variant';

export interface VariantRequest {
  /** Tipo di giornata richiesto; senza, quello predefinito del giorno (fonte). */
  type?: string | null;
  /** Fonte dei pasti fissata per la data (scambio, 2b); senza, il giorno stesso. */
  mealsFrom?: MealsFrom | null;
}

export interface ResolvedDietDay extends DietDay {
  /** Tipo predefinito del giorno della fonte. */
  defaultType: string | null;
  /** Tipi delle varianti del giorno della fonte (per i chip della Dieta), nell'ordine del piano. */
  variantTypes: (string | null)[];
  /** Giorno e variante da cui arrivano davvero pasti, integratori e nota. */
  source: { weekday: number; type: string | null };
  fallback: VariantFallback;
}

export function planDay(payload: Pick<DietPayload, 'days'>, weekday: number): DietPlanDay | undefined {
  return payload.days.find((d) => d.weekday === weekday);
}

/** Variante predefinita di un giorno: quella del tipo predefinito, altrimenti la prima. */
export function defaultVariant(day: DietPlanDay): DietVariant {
  return day.variants.find((v) => v.type === day.defaultType) ?? day.variants[0]!;
}

function variantOf(day: DietPlanDay, type: string | null): DietVariant | undefined {
  return type === null ? undefined : day.variants.find((v) => v.type === type);
}

/**
 * Giorni in ordine di vicinanza (settimana circolare: domenica e lunedì distano 1); a parità vince il successivo.
 * Il giorno stesso escluso.
 */
export function nearestWeekdays(weekday: number): number[] {
  const out: number[] = [];
  for (let distance = 1; distance <= 3; distance++) {
    out.push(((weekday - 1 + distance) % 7) + 1);
    out.push(((weekday - 1 - distance + 7) % 7) + 1);
  }
  return out;
}

const flatten = (weekday: number, type: string | null, variant: DietVariant): DietDay => ({
  weekday,
  type,
  note: variant.note,
  supplements: variant.supplements,
  meals: variant.meals,
});

/**
 * Variante da seguire per un giorno della settimana (`weekday` = giorno del calendario). Il giorno appiattito ha
 * il `weekday` del giorno seguito (quello di `mealsFrom`, se c'è), come prima del formato v3.
 * Fonte = `mealsFrom` se c'è, altrimenti il giorno stesso; tipo = quello richiesto, altrimenti il predefinito
 * della variante della fonte. `null` se il giorno della fonte non è nel piano.
 */
export function resolveDietDay(payload: Pick<DietPayload, 'days'>, weekday: number, request: VariantRequest = {}): ResolvedDietDay | null {
  const sourceWeekday = request.mealsFrom?.weekday ?? weekday;
  const source = planDay(payload, sourceWeekday);
  if (!source) return null;
  const variantTypes = source.variants.map((v) => v.type);
  const base = { defaultType: source.defaultType, variantTypes };

  // Fonte fissata con una variante (o la predefinita) e nessun tipo richiesto: quella, com'è.
  const fixedType = request.mealsFrom ? (request.mealsFrom.type ?? source.defaultType) : source.defaultType;
  const wanted = request.type === undefined ? fixedType : request.type;

  const own = wanted === null ? defaultVariant(source) : variantOf(source, wanted);
  if (own) {
    return { ...flatten(sourceWeekday, own.type ?? wanted, own), ...base, source: { weekday: sourceWeekday, type: own.type }, fallback: 'none' };
  }

  // Ripiego: la stessa variante del giorno più vicino che ce l'ha.
  for (const near of nearestWeekdays(sourceWeekday)) {
    const other = planDay(payload, near);
    const variant = other && variantOf(other, wanted);
    if (variant) {
      return { ...flatten(sourceWeekday, wanted, variant), ...base, source: { weekday: near, type: variant.type }, fallback: 'other-day' };
    }
  }

  // Nessun giorno ha quella variante: pasti predefiniti, target del tipo richiesto (lo dice l'avviso).
  const fallback = defaultVariant(source);
  return { ...flatten(sourceWeekday, wanted, fallback), ...base, source: { weekday: sourceWeekday, type: fallback.type }, fallback: 'no-variant' };
}
