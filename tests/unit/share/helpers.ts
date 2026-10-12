import { parseWorkoutFile } from '../../../src/lib/data/read-file';
import type { DietFile } from '../../../src/lib/data/schemas/diet-file';
import type { WorkoutFile } from '../../../src/lib/data/schemas/workout-file';
import typicalFixture from '../../fixtures/share/workout-typical.json';
import { extendedFile } from '../diet/helpers';

/** Indirizzo dell'app su GitHub Pages (i test non dipendono da `location`). */
export const BASE = 'https://rojo-66.github.io/Healthy/';

/** Scheda tipica del PT (6 esercizi con note), finta. */
export function typicalWorkoutFile(): WorkoutFile {
  const result = parseWorkoutFile(structuredClone(typicalFixture));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

/** Scheda lunga: `n` esercizi, ognuno con una nota diversa. */
export function bigWorkoutFile(n: number): WorkoutFile {
  const base = typicalWorkoutFile();
  const items = Array.from({ length: n }, (_, i) => ({
    ...base.items[i % base.items.length]!,
    name: `Esercizio di prova numero ${i + 1}`,
    note: `Nota ${i + 1}: controlla la discesa per ${2 + (i % 4)} secondi e respira a ogni ripetizione.`,
  }));
  return { ...base, items };
}

export function dietFile(): DietFile {
  return extendedFile();
}

/** Dieta piccola (un giorno, senza ricette): abbastanza corta per un link. */
export function smallDietFile(): DietFile {
  const full = extendedFile();
  const day = full.days[0]!;
  return { ...full, days: [{ ...day, meals: day.meals.map((m) => ({ ...m, recipe: null })) }], recipes: [] };
}
