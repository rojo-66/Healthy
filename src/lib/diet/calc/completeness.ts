import { lookup } from '../../data/errors';
import { weekdayName, type DietPayload } from '../../data/schemas/diet-payload';
import { hasCompleteValues, type MissingReason } from './nutrients';

/**
 * Completamento guidato (§ 6.1): cosa manca al piano. La percentuale conta i giorni con un tipo di giornata,
 * i tipi usati con i target e gli alimenti usati con i valori. Ricette e integratori si mostrano ma non contano
 * (un piano può non averne, e le ricette si aggiungono solo con l'editor, non in M3).
 */

export type ChecklistId = 'day-types' | 'targets' | 'products' | 'recipes' | 'supplements';

export interface ChecklistItem {
  id: ChecklistId;
  /** Testo breve del chip: "target", "macro per alimento", "4 ricette", "integratori". */
  label: string;
  done: boolean;
  /** Entra nella percentuale. */
  counted: boolean;
  /** Spiegazione di cosa manca (vuota se fatto). */
  detail: string;
}

export interface MissingProduct {
  key: string;
  name: string;
  reason: MissingReason;
}

export interface Completeness {
  /** 0–100. */
  percent: number;
  items: ChecklistItem[];
  /** Giorni (1–7) senza tipo di giornata. */
  untypedDays: number[];
  /** Tipi di giornata usati e senza target. */
  typesWithoutTargets: string[];
  /** Alimenti usati nel piano senza valori, in ordine di comparsa. */
  missingProducts: MissingProduct[];
}

/** Chiavi dei prodotti usati nei pasti, in ordine di comparsa. */
export function usedProductKeys(payload: DietPayload): string[] {
  const keys = new Set<string>();
  for (const day of payload.days) for (const meal of day.meals) for (const item of meal.items) keys.add(item.p);
  return [...keys];
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

/** "Martedì: manca il tipo di giornata" / "Martedì, giovedì e sabato: manca il tipo di giornata". */
function untypedDetail(days: readonly number[]): string {
  if (days.length === 0) return '';
  if (days.length === 7) return 'Nessun giorno ha il tipo di giornata';
  const names = days.map((day, i) => (i === 0 ? weekdayName(day) : weekdayName(day).toLowerCase()));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
  return `${list}: manca il tipo di giornata`;
}

export function planCompleteness(payload: DietPayload): Completeness {
  const untypedDays = payload.days.filter((day) => day.type === null).map((day) => day.weekday);
  const usedTypes = [...new Set(payload.days.flatMap((day) => (day.type === null ? [] : [day.type])))];
  const typesWithoutTargets = usedTypes.filter((key) => !lookup(payload.dayTypes, key)?.targets);

  const missingProducts: MissingProduct[] = [];
  const used = usedProductKeys(payload);
  for (const key of used) {
    const product = lookup(payload.products, key);
    if (!product || hasCompleteValues(product)) continue;
    missingProducts.push({ key, name: product.name, reason: product.per100 === null ? 'no-values' : 'no-piece-grams' });
  }

  const recipes = payload.recipes.length;
  const supplementDays = payload.days.filter((day) => day.supplements.length > 0).length;
  const targetsDone = untypedDays.length === 0 && typesWithoutTargets.length === 0;

  const items: ChecklistItem[] = [
    {
      id: 'day-types',
      label: 'tipi di giornata',
      done: untypedDays.length === 0,
      counted: true,
      detail: untypedDetail(untypedDays),
    },
    {
      id: 'targets',
      label: 'target',
      done: targetsDone,
      counted: true,
      detail: targetsDone
        ? ''
        : typesWithoutTargets.length > 0
          ? `Mancano i target di ${plural(typesWithoutTargets.length, 'un tipo di giornata', 'tipi di giornata')}`
          : 'Servono i tipi di giornata per inserire i target',
    },
    {
      id: 'products',
      label: 'macro per alimento',
      done: missingProducts.length === 0,
      counted: true,
      detail:
        missingProducts.length === 0
          ? ''
          : `${plural(missingProducts.length, 'Un alimento', 'alimenti')} senza valori nutrizionali`,
    },
    {
      id: 'recipes',
      label: recipes === 0 ? 'ricette' : plural(recipes, '1 ricetta', 'ricette'),
      done: recipes > 0,
      counted: false,
      detail: recipes === 0 ? 'Nessuna ricetta nel piano' : '',
    },
    {
      id: 'supplements',
      label: 'integratori',
      done: supplementDays > 0,
      counted: false,
      detail: supplementDays === 0 ? 'Nessun integratore indicato' : '',
    },
  ];

  const total = payload.days.length + usedTypes.length + used.length;
  const done =
    payload.days.length - untypedDays.length +
    (usedTypes.length - typesWithoutTargets.length) +
    (used.length - missingProducts.length);
  return {
    percent: total === 0 ? 100 : Math.floor((done / total) * 100),
    items,
    untypedDays,
    typesWithoutTargets,
    missingProducts,
  };
}
