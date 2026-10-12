/**
 * Età dall'anno di nascita (il profilo non chiede il giorno): anno di riferimento − anno di nascita.
 * Caso limite: prima del compleanno l'età risulta di 1 anno più alta di quella vera. Si accetta:
 * nella stima del BMR (Mifflin-St Jeor, −5 kcal per anno) l'errore è al massimo 5 kcal.
 */

/** Anno di un giorno `AAAA-MM-GG` o di una data. */
function yearOf(ref: Date | string): number {
  return typeof ref === 'string' ? Number(ref.slice(0, 4)) : ref.getFullYear();
}

/** Età in anni; `null` se manca l'anno di nascita o se è dopo il riferimento. */
export function ageFromBirthYear(birthYear: number | null | undefined, ref: Date | string): number | null {
  if (birthYear === null || birthYear === undefined) return null;
  const age = yearOf(ref) - birthYear;
  return age >= 0 ? age : null;
}

/** Valori fuori da questi intervalli si salvano, ma con un avviso (possibile errore di battitura). */
export const PLAUSIBLE = {
  age: { min: 14, max: 100 },
  heightCm: { min: 120, max: 220 },
  weightKg: { min: 30, max: 250 },
} as const;

/** La formula di Mifflin-St Jeor è pensata per gli adulti. */
export const ADULT_AGE = 18;
