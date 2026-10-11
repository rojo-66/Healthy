import { routeHref } from '../routes';

/** Dieta › Ricette con la ricetta `n` aperta (link "Ricetta N" della Home). */
export const recipeHref = (n: number) => routeHref('/dieta', { ricetta: String(n) });

/** Numero di ricetta dal parametro `?ricetta=` (testo dall'indirizzo): `null` se non è un numero valido. */
export function parseRecipeParam(value: string | undefined): number | null {
  if (value === undefined || !/^\d{1,4}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 ? n : null;
}
