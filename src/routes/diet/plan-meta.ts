import type { DietPlan } from '../../lib/data/schemas/diet-plans';
import { shortDate } from '../../lib/diet/calc/calendar';

/** "Nutrizionista · importato l'11 ott · v2" (come il mockup). */
export function planMeta(plan: DietPlan): string {
  const from = plan.author ? plan.author : plan.origin === 'mydiet' ? 'Da MyDiet' : 'Da file';
  const parts = [from];
  if (plan.importedAt) {
    const day = shortDate(new Date(plan.importedAt));
    // "l'8 ott", "l'11 ott": elisione davanti a vocale (1, 8, 11); "il 12 ott" altrimenti.
    parts.push(`importato ${/^(1|8|11)\b/.test(day) ? "l'" : 'il '}${day}`);
  }
  parts.push(`v${plan.version}`);
  return parts.join(' · ');
}
