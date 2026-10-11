import { lookup } from '../../data/errors';
import type { DietPayload } from '../../data/schemas/diet-payload';
import { formatQuantity, type Unit } from '../format';

/**
 * Lista della spesa della settimana: somma dei pasti dei giorni del piano (gli scambi di giorno non contano).
 * Si sommano solo quantità dello stesso prodotto, che ha una sola unità: mai conversioni tra prodotti.
 */

export interface ShoppingItem {
  key: string;
  name: string;
  unit: Unit;
  quantity: number;
  /** "715 g", "1,6 kg", "5". */
  text: string;
}

export interface ShoppingGroup {
  /** Reparto ("" se il prodotto non ne ha uno → "Altro" nell'interfaccia). */
  cat: string;
  items: ShoppingItem[];
}

export interface ShoppingList {
  groups: ShoppingGroup[];
  /** Prodotti usati ma esclusi (`shop: false`), es. integratori e pasti liberi. */
  excluded: { key: string; name: string; cat: string }[];
  total: number;
}

export const NO_CATEGORY_LABEL = 'Altro';

export function buildShoppingList(payload: DietPayload): ShoppingList {
  const sums = new Map<string, number>();
  const excluded = new Map<string, { key: string; name: string; cat: string }>();
  for (const day of payload.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const product = lookup(payload.products, item.p);
        if (!product) continue;
        if (!product.shop) {
          if (!excluded.has(item.p)) excluded.set(item.p, { key: item.p, name: product.name, cat: product.cat });
          continue;
        }
        sums.set(item.p, (sums.get(item.p) ?? 0) + item.q);
      }
    }
  }

  const byCat = new Map<string, ShoppingItem[]>();
  for (const [key, raw] of sums) {
    const product = lookup(payload.products, key)!;
    // Somme di decimali: niente 0,30000000004.
    const quantity = Math.round(raw * 100) / 100;
    const items = byCat.get(product.cat) ?? [];
    items.push({ key, name: product.name, unit: product.unit, quantity, text: formatQuantity(product.unit, quantity) });
    byCat.set(product.cat, items);
  }

  // Ordine dei reparti: quello di `categories`, poi gli altri come compaiono, "senza reparto" in fondo.
  const order = [
    ...payload.categories.filter((cat) => byCat.has(cat)),
    ...[...byCat.keys()].filter((cat) => cat !== '' && !payload.categories.includes(cat)),
    ...(byCat.has('') ? [''] : []),
  ];
  const groups = order.map((cat) => ({ cat, items: byCat.get(cat) ?? [] }));
  return { groups, excluded: [...excluded.values()], total: sums.size };
}

/** Quante voci della lista sono spuntate (le spunte di prodotti non più in lista non contano). */
export function shoppingProgress(list: ShoppingList, checked: Readonly<Record<string, boolean>>): number {
  return list.groups.reduce((n, g) => n + g.items.filter((item) => Object.hasOwn(checked, item.key) && checked[item.key]).length, 0);
}

/** Testo semplice da condividere: solo ciò che resta da comprare, per reparto. */
export function shoppingShareText(list: ShoppingList, checked: Readonly<Record<string, boolean>>, weekLabel: string): string {
  const lines = [`Spesa · settimana ${weekLabel}`];
  let left = 0;
  for (const group of list.groups) {
    const items = group.items.filter((item) => !(Object.hasOwn(checked, item.key) && checked[item.key]));
    if (items.length === 0) continue;
    left += items.length;
    lines.push('', (group.cat || NO_CATEGORY_LABEL).toUpperCase());
    for (const item of items) lines.push(`• ${item.name} — ${item.text}`);
  }
  if (left === 0) lines.push('', 'Tutto già comprato ✓');
  return lines.join('\n');
}
