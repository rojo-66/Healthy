import type { Readiness } from '../data/schemas/sessions';

export type ReadinessKey = keyof Readiness;

/** Risposte date finora (1–5); le voci mancanti non ci sono. */
export type ReadinessDraft = Partial<Record<ReadinessKey, number>>;

export interface ReadinessItem {
  key: ReadinessKey;
  label: string;
  /** Etichetta corta per le barre del Riepilogo. */
  short: string;
  /** Testo sotto l'1 e sotto il 5: su tutte le voci 5 = meglio (SPEC § 5.4). */
  low: string;
  high: string;
}

export const READINESS_ITEMS: readonly ReadinessItem[] = [
  { key: 'sleep', label: 'Sonno', short: 'Sonno', low: 'pessimo', high: 'ottimo' },
  { key: 'mood', label: 'Umore', short: 'Umore', low: 'giù di morale', high: 'alle stelle' },
  { key: 'energy', label: 'Energia', short: 'Energia', low: 'a terra', high: 'carico' },
  { key: 'stress', label: 'Stress', short: 'Stress', low: 'molto stressato', high: 'rilassato' },
  {
    key: 'soreness',
    label: 'Affaticamento muscolare',
    short: 'Affaticamento',
    low: 'molto indolenzito',
    high: 'nessun dolore',
  },
];

export const READINESS_MAX = READINESS_ITEMS.length * 5;

const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

/** Voci con una risposta valida. */
export function answeredCount(draft: ReadinessDraft): number {
  return READINESS_ITEMS.filter((item) => isScore(draft[item.key])).length;
}

/** Somma delle risposte date (su 25). */
export function readinessTotal(draft: ReadinessDraft | Readiness): number {
  return READINESS_ITEMS.reduce((sum, item) => {
    const v = (draft as ReadinessDraft)[item.key];
    return sum + (isScore(v) ? v : 0);
  }, 0);
}

/** Readiness completo (tutte e 5 le risposte), oppure `null`: "Avanti" è attivo solo se non è `null`. */
export function toReadiness(draft: ReadinessDraft): Readiness | null {
  const out: Partial<Readiness> = {};
  for (const item of READINESS_ITEMS) {
    const v = draft[item.key];
    if (!isScore(v)) return null;
    out[item.key] = v;
  }
  return out as Readiness;
}
