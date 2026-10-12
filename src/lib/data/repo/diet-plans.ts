import { db } from '../db';
import { parseOrThrow, ValidationError } from '../errors';
import { MAX_TEXT } from '../limits';
import type { DietFile } from '../schemas/diet-file';
import type { DietPayload } from '../schemas/diet-payload';
import { dietPlanSchema, type DietPlan, type DietPlanOrigin } from '../schemas/diet-plans';
import { createTableRepo } from './table-repo';

export const dietPlansRepo = createTableRepo('dietPlans');

/** Il piano attivo, se c'è (i booleani non sono indicizzabili: filtro in memoria, i piani sono pochi). */
export async function getActiveDietPlan(): Promise<DietPlan | undefined> {
  return (await db.dietPlans.toArray()).find((plan) => plan.active);
}

/** Ordine dei piani: dal più recente (importazione, poi data di validità). */
export function comparePlansNewestFirst(a: DietPlan, b: DietPlan): number {
  const byImport = (b.importedAt ?? '').localeCompare(a.importedAt ?? '');
  return byImport !== 0 ? byImport : (b.validFrom ?? '').localeCompare(a.validFrom ?? '');
}

/**
 * Piani dal più recente. Ordinati in memoria: IndexedDB non indicizza i `null`,
 * quindi `orderBy('validFrom')` perderebbe i piani senza data.
 */
export async function listDietPlans(): Promise<DietPlan[]> {
  return (await db.dietPlans.toArray()).sort(comparePlansNewestFirst);
}

/** Piani archiviati (i precedenti), dal più recente. */
export async function listArchivedDietPlans(): Promise<DietPlan[]> {
  return (await listDietPlans()).filter((plan) => plan.archived && !plan.active);
}

/** Il piano attivo diventa archiviato, gli altri non attivi: si scrive solo ciò che cambia. */
function deactivateOthers(plans: readonly DietPlan[], keepId: string): DietPlan[] {
  return plans
    .filter((plan) => plan.id !== keepId && plan.active)
    .map((plan) => ({ ...plan, active: false, archived: true }));
}

/** Rende attivo un piano (es. "Ripristina" dall'archivio) e archivia quello attivo, tutto in una transazione. */
export function activateDietPlan(id: string): Promise<void> {
  return db.transaction('rw', db.dietPlans, async () => {
    const plans = await db.dietPlans.toArray();
    const target = plans.find((plan) => plan.id === id);
    if (!target) throw new ValidationError([`Piano alimentare «${id}» non trovato`]);
    const changed = deactivateOthers(plans, id);
    if (!target.active || target.archived) changed.push({ ...target, active: true, archived: false });
    await db.dietPlans.bulkPut(changed);
  });
}

/**
 * Come salvare un piano importato:
 * - `new`: piano nuovo (errore se l'id esiste già);
 * - `replace`: sostituisce il piano con lo stesso id;
 * - `copy`: nuovo id, titolo "… (copia)".
 */
export type DietSaveMode = 'new' | 'replace' | 'copy';

const COPY_SUFFIX = ' (copia)';

function copyTitle(title: string): string {
  return title.slice(0, MAX_TEXT.name - COPY_SUFFIX.length).trimEnd() + COPY_SUFFIX;
}

/** Solo il contenuto del piano, senza busta e metadati del file. */
export function payloadOf(file: DietFile): DietPayload {
  return {
    dayTypes: file.dayTypes,
    categories: file.categories,
    products: file.products,
    days: file.days,
    recipes: file.recipes,
    generalNotes: file.generalNotes,
  };
}

/**
 * Salva un piano importato: diventa il piano attivo, quello attivo prima va in archivio (non si cancella).
 * La riga è validata prima di aprire la transazione: o si scrive tutto o niente.
 */
export async function saveImportedPlan(
  file: DietFile,
  origin: DietPlanOrigin,
  mode: DietSaveMode,
  now: Date = new Date(),
  newId: () => string = () => crypto.randomUUID(),
): Promise<DietPlan> {
  const copy = mode === 'copy';
  const plan = parseOrThrow(dietPlanSchema, {
    id: copy ? newId() : file.id,
    version: file.version,
    title: copy ? copyTitle(file.title) : file.title,
    author: file.author,
    validFrom: file.validFrom,
    active: true,
    archived: false,
    importedAt: now.toISOString(),
    origin,
    payload: payloadOf(file),
  });

  return db.transaction('rw', db.dietPlans, async () => {
    const plans = await db.dietPlans.toArray();
    const existing = plans.find((p) => p.id === plan.id);
    if (mode === 'new' && existing) {
      throw new ValidationError([`Esiste già un piano con lo stesso identificativo («${plan.title}»)`]);
    }
    // "Sostituisci" (M8): la versione vecchia non si perde, resta nell'archivio con un id suo ("Ripristina").
    const kept = mode === 'replace' && existing ? [{ ...existing, id: newId(), active: false, archived: true }] : [];
    await db.dietPlans.bulkPut([...deactivateOthers(plans, plan.id), ...kept, plan]);
    return plan;
  });
}

/** Sostituisce il contenuto di un piano (completamento guidato), con validazione. */
export function updatePlanPayload(id: string, payload: DietPayload): Promise<DietPlan> {
  return dietPlansRepo.update(id, { payload });
}
