import { toIsoDate } from '../calc/calendar';
import model from './healthy-dieta-modello.json';

/**
 * Modello vuoto del piano esteso (§ 8.2) da far compilare a Claude ("Prepara il piano con Claude").
 * Il JSON è importato nel codice: finisce nel bundle (e nel precache), quindi si scarica anche offline.
 * Il modello non contiene e non deve mai contenere dati reali.
 */

export const TEMPLATE_FILE_NAME = 'healthy-dieta-modello.json';

/** Messaggio da mandare a Claude insieme alla dieta e al modello (passo 2 della guida). */
export const CLAUDE_PROMPT =
  'Ti allego la mia dieta e il modello healthy-dieta-modello.json. Compila il modello seguendo le istruzioni che contiene e restituiscimi il file JSON completo da scaricare. Poi elencami cosa mancava nella dieta.';

/** Import del modello non compilato: si rifiuta e si offre la guida. */
export const EMPTY_TEMPLATE_MESSAGE = 'Questo è il modello vuoto: compilalo prima con Claude';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Copia profonda del modello, con `_modello: true` e la data di generazione di oggi. */
export function templateContent(now: Date = new Date()): Record<string, unknown> {
  const copy = structuredClone(model) as Record<string, unknown>;
  copy._modello = true;
  copy._generato = toIsoDate(now);
  return copy;
}

/** File da consegnare con `deliverFile` (Web Share con file, altrimenti download). */
export function templateFile(now: Date = new Date()): File {
  return new File([JSON.stringify(templateContent(now), null, 2)], TEMPLATE_FILE_NAME, { type: 'application/json' });
}

function isEmptyMeal(meal: unknown): boolean {
  if (!isRecord(meal)) return true;
  const name = typeof meal.name === 'string' ? meal.name.trim() : '';
  const items = Array.isArray(meal.items) ? meal.items : [];
  return name === '' && items.length === 0;
}

/** Pasti di un giorno del modello: quelli delle varianti (v3) o del giorno (modello v2, prima del 2b). */
function dayMeals(day: Record<string, unknown>): unknown[] {
  if (Array.isArray(day.variants)) return day.variants.flatMap((v) => (isRecord(v) && Array.isArray(v.meals) ? v.meals : []));
  return Array.isArray(day.meals) ? day.meals : [];
}

/** Ancora il modello vuoto: `_modello: true`, nessun prodotto e tutti i pasti senza nome e senza alimenti. */
export function isEmptyTemplate(raw: Record<string, unknown>): boolean {
  if (raw._modello !== true) return false;
  if (isRecord(raw.products) && Object.keys(raw.products).length > 0) return false;
  const days = Array.isArray(raw.days) ? raw.days : [];
  return days.every((day) => !isRecord(day) || dayMeals(day).every(isEmptyMeal));
}
