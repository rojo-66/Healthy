import { lookup } from '../../data/errors';
import { APP_ID, hhmm, isoDate } from '../../data/schemas/common';
import { DIET_FILE_KIND, DIET_FILE_VERSION } from '../../data/schemas/diet-file';
import { weekdayName } from '../../data/schemas/diet-payload';
import { fnv1a, FNV_OFFSET } from '../../hash';
import { MONTHS } from '../calc/calendar';
import { formatQuantity } from '../format';
import type { MyDietDiet, MyDietFile } from './mydiet-schema';

/**
 * MyDiet → formato esteso (SPEC § 8.3). Il risultato è una bozza: va sempre validata con `dietFileSchema`.
 * Ciò che MyDiet non ha (valori nutrizionali, target, tipi di giornata, ricette, orari) resta mancante:
 * lo completa il completamento guidato, mai inventato qui.
 */

/** Pasti di MyDiet nell'ordine della giornata, con il nome da mostrare. */
export const MYDIET_MEALS: readonly (readonly [key: string, label: string])[] = [
  ['colazione', 'Colazione'],
  ['spuntino1', 'Spuntino'],
  ['pranzo', 'Pranzo'],
  ['spuntino2', 'Spuntino'],
  ['cena', 'Cena'],
];

const SUPPLEMENT_CATEGORY = 'integratori';
const FALLBACK_TITLE = 'Piano MyDiet';

export interface MyDietConversion {
  /** Dati nel formato del file esteso (§ 8.2), da validare. */
  draft: Record<string, unknown>;
  /** Cose ignorate o da sapere, in italiano. */
  warnings: string[];
}

/** JSON con le chiavi in ordine: la stessa dieta dà sempre la stessa impronta. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Impronta del contenuto (16 cifre esadecimali): reimportare lo stesso file dà lo stesso id. */
export function myDietFingerprint(diet: MyDietDiet): string {
  const text = stableStringify(diet);
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return hex(fnv1a(text, FNV_OFFSET)) + hex(fnv1a(text, 0x01000193));
}

/** Data `AAAA-MM-GG` dall'inizio di `esportato` ("2026-10-08T09:52:30"), se valida. */
export function exportDate(esportato: string | undefined): string | null {
  const day = esportato?.slice(0, 10) ?? '';
  return isoDate.safeParse(day).success ? day : null;
}

/** "Ottobre 2026" dalla data di esportazione. */
export function titleFromDate(date: string | null): string {
  if (!date) return FALLBACK_TITLE;
  const [year, month] = date.split('-').map(Number);
  const name = MONTHS[(month ?? 1) - 1];
  return name ? `${name} ${year}` : FALLBACK_TITLE;
}

function validTime(value: string | undefined): value is string {
  return value !== undefined && hhmm.safeParse(value).success;
}

function labelOfUnknownMeal(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function convertMyDiet(file: MyDietFile): MyDietConversion {
  const { dieta } = file;
  const warnings: string[] = [];
  const validFrom = exportDate(file.esportato);

  const products = Object.fromEntries(
    Object.entries(dieta.prodotti).map(([key, p]) => [
      key,
      { name: p.nome, cat: p.cat, unit: p.unita, shop: p.spesa, per100: null, pieceGrams: null },
    ]),
  );

  const days = dieta.giorni.map((giorno, index) => {
    const weekday = index + 1;
    const dayName = weekdayName(weekday);
    const known = MYDIET_MEALS.filter(([key]) => Object.hasOwn(giorno.pasti, key));
    const others = Object.keys(giorno.pasti)
      .filter((key) => !MYDIET_MEALS.some(([k]) => k === key))
      .map((key) => [key, labelOfUnknownMeal(key)] as const);

    const supplements: { name: string; when: string; dose: string; skip: boolean }[] = [];
    const meals = [...known, ...others].map(([key, label]) => {
      const pasto = giorno.pasti[key]!;
      let window: [string, string] | null = null;
      if (validTime(pasto.abilita) && validTime(pasto.fine)) window = [pasto.abilita, pasto.fine];
      else if (pasto.abilita !== undefined || pasto.fine !== undefined) {
        warnings.push(`${dayName} › ${label}: orari non validi, ignorati`);
      }

      for (const item of pasto.items) {
        const product = lookup(dieta.prodotti, item.p);
        if (!product || product.cat.trim().toLowerCase() !== SUPPLEMENT_CATEGORY) continue;
        const when = label.toLowerCase();
        if (supplements.some((s) => s.name === product.nome && s.when === when)) continue;
        supplements.push({ name: product.nome, when, dose: formatQuantity(product.unita, item.q), skip: false });
      }

      return { key, label, time: null, window, name: pasto.nome, recipe: null, items: pasto.items };
    });

    return { weekday, type: null, note: giorno.nota, supplements, meals };
  });

  if (dieta.giorni.length < 7) {
    warnings.push(`Il file contiene ${dieta.giorni.length === 1 ? 'un solo giorno' : `solo ${dieta.giorni.length} giorni`} (da lunedì).`);
  }

  const categories = [...new Set(dieta.categorie.filter((cat) => cat !== ''))];

  return {
    draft: {
      app: APP_ID,
      kind: DIET_FILE_KIND,
      schemaVersion: DIET_FILE_VERSION,
      id: `mydiet-${myDietFingerprint(dieta)}`,
      version: 1,
      title: titleFromDate(validFrom),
      author: '',
      validFrom,
      dayTypes: {},
      categories,
      products,
      days,
      recipes: [],
    },
    warnings,
  };
}
