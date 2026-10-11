import { db } from '../db';
import { ValidationError } from '../errors';
import type { DietPlan } from '../schemas/diet-plans';
import { createTableRepo } from './table-repo';

export const dietPlansRepo = createTableRepo('dietPlans');

/** Il piano attivo, se c'è (i booleani non sono indicizzabili: filtro in memoria, i piani sono pochi). */
export async function getActiveDietPlan(): Promise<DietPlan | undefined> {
  return (await db.dietPlans.toArray()).find((plan) => plan.active);
}

/** Piani dal più recente (data di validità). */
export function listDietPlans(): Promise<DietPlan[]> {
  return db.dietPlans.orderBy('validFrom').reverse().toArray();
}

/** Rende attivo un piano e disattiva gli altri, tutto in una transazione. */
export function activateDietPlan(id: string): Promise<void> {
  return db.transaction('rw', db.dietPlans, async () => {
    const plans = await db.dietPlans.toArray();
    if (!plans.some((plan) => plan.id === id)) throw new ValidationError([`Piano alimentare «${id}» non trovato`]);
    const changed = plans
      .filter((plan) => plan.active !== (plan.id === id))
      .map((plan) => ({ ...plan, active: plan.id === id, archived: plan.id === id ? false : plan.archived }));
    await db.dietPlans.bulkPut(changed);
  });
}
