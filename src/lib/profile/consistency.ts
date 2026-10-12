import type { Measurement } from '../data/schemas/measurements';
import { formatDecimal } from '../diet/format';

/**
 * Controlli di una misura prima del salvataggio.
 * - **Errori** (bloccano): valori impossibili, es. una parte più grande del tutto.
 * - **Avvisi** (gialli, non bloccano): valori che non tornano tra loro, forse un errore di battitura.
 * Non sono valutazioni sulla salute: dicono solo se i numeri sono coerenti.
 */

export type MeasurementValues = Omit<Measurement, 'id' | 'date' | 'notes'>;
export type ValueField = keyof MeasurementValues;

export interface FieldError {
  field: ValueField;
  message: string;
}

export interface ConsistencyReport {
  errors: FieldError[];
  warnings: string[];
}

/** FM + FFM può scostarsi dal peso al massimo di 1 kg o dell'1,5 % del peso (il più grande dei due). */
export const SUM_TOLERANCE_KG = 1;
export const SUM_TOLERANCE_PCT = 1.5;
/** FM % misurata e FM kg / peso possono differire al massimo di 1 punto. */
export const PCT_TOLERANCE = 1;

const kg = (n: number) => `${formatDecimal(n, 1)} kg`;
const l = (n: number) => `${formatDecimal(n, 1)} L`;

export function sumTolerance(weightKg: number): number {
  return Math.max(SUM_TOLERANCE_KG, (weightKg * SUM_TOLERANCE_PCT) / 100);
}

export function checkMeasurement(m: MeasurementValues): ConsistencyReport {
  const errors: FieldError[] = [];
  const warnings: string[] = [];
  const { weightKg: w, fmKg: fm, ffmKg: ffm, bcmKg: bcm, tbwL: tbw, ecwL: ecw, fmPct } = m;

  if (w !== null && fm !== null && fm > w) {
    errors.push({ field: 'fmKg', message: `La massa grassa (${kg(fm)}) supera il peso (${kg(w)}).` });
  }
  if (w !== null && ffm !== null && ffm > w) {
    errors.push({ field: 'ffmKg', message: `La massa magra (${kg(ffm)}) supera il peso (${kg(w)}).` });
  }
  // La BCM è una parte della massa magra (misurata o, se manca, peso − FM).
  const ffmForBcm = ffm ?? (w !== null && fm !== null && fm <= w ? w - fm : null);
  if (bcm !== null && ffmForBcm !== null && bcm > ffmForBcm) {
    const what = ffm !== null ? 'la massa magra' : 'la massa magra calcolata (peso − FM)';
    errors.push({ field: 'bcmKg', message: `La massa cellulare (${kg(bcm)}) supera ${what} (${kg(ffmForBcm)}).` });
  } else if (bcm !== null && w !== null && bcm > w) {
    errors.push({ field: 'bcmKg', message: `La massa cellulare (${kg(bcm)}) supera il peso (${kg(w)}).` });
  }
  if (ecw !== null && tbw !== null && ecw > tbw) {
    errors.push({ field: 'ecwL', message: `L'acqua extracellulare (${l(ecw)}) supera l'acqua totale (${l(tbw)}).` });
  }
  // 1 L d'acqua pesa circa 1 kg: l'acqua non può pesare più della persona.
  if (tbw !== null && w !== null && tbw > w) {
    errors.push({ field: 'tbwL', message: `L'acqua totale (${l(tbw)}) supera il peso (${kg(w)}).` });
  }

  if (w !== null && fm !== null && ffm !== null && fm <= w && ffm <= w) {
    const sum = fm + ffm;
    if (Math.abs(sum - w) > sumTolerance(w) + 1e-9) {
      warnings.push(`FM + FFM = ${kg(sum)}, ma il peso è ${kg(w)}: controlla i valori.`);
    }
  }
  if (w !== null && w > 0 && fm !== null && fmPct !== null && fm <= w) {
    const fromKg = (fm / w) * 100;
    if (Math.abs(fromKg - fmPct) > PCT_TOLERANCE + 1e-9) {
      warnings.push(
        `FM ${formatDecimal(fmPct, 1)} % non torna con ${kg(fm)} su ${kg(w)} (${formatDecimal(fromKg, 1)} %): controlla i valori.`,
      );
    }
  }
  return { errors, warnings };
}
