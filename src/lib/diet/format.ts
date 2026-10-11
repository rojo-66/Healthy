/**
 * Numeri all'italiana per la Dieta. Niente `Intl` per le migliaia: in italiano `Intl` non separa
 * i numeri di 4 cifre ("1812"), mentre i mockup mostrano "1.812".
 */

/** Intero con il punto delle migliaia: 1812 → "1.812". */
export function formatInt(value: number): string {
  const n = Math.round(value);
  const sign = n < 0 ? '−' : '';
  return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Decimale con la virgola: 26.94 → "26,9"; con `trim` toglie ",0" (1.0 → "1"). */
export function formatDecimal(value: number, digits = 1, trim = false): string {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  const [int = '0', dec = ''] = Math.abs(rounded).toFixed(digits).split('.');
  const sign = rounded < 0 ? '−' : '';
  const intPart = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (digits === 0 || (trim && /^0+$/.test(dec))) return sign + intPart;
  return `${sign}${intPart},${dec}`;
}

export type Unit = 'g' | 'pz' | 'ml';

/**
 * Quantità di un prodotto con la sua unità (spesa, integratori): "715 g", "1,6 kg", "250 ml", "1,5 L", "5".
 * I pezzi sono solo il numero, come nel mockup.
 */
export function formatQuantity(unit: Unit, quantity: number): string {
  if (unit === 'pz') return formatDecimal(quantity, 1, true);
  const big = unit === 'g' ? 'kg' : 'L';
  if (quantity >= 1000) return `${formatDecimal(Math.round(quantity / 100) / 10, 1, true)} ${big}`;
  return `${formatDecimal(quantity, 1, true)} ${unit}`;
}

/** "al 36%", "allo 0%", "all'8%", "all'11%", "all'80%": preposizione articolata davanti a una percentuale. */
export function atPercent(percent: number): string {
  const n = Math.round(percent);
  if (n === 0) return 'allo 0%';
  if (n === 1 || n === 11 || String(n).startsWith('8')) return `all'${n}%`;
  return `al ${n}%`;
}
