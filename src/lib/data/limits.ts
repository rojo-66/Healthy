/**
 * Limiti contro file enormi o malevoli (SPEC § 8). Tutti in un posto: schemi, lettura file e test li condividono.
 */
const MB = 1024 * 1024;

/** Dimensione massima dei file, controllata su `file.size` prima di leggerli. */
export const MAX_BYTES = {
  /** Scheda o piano alimentare condiviso. */
  share: 1 * MB,
  backup: 20 * MB,
} as const;

/** Lunghezza massima dei testi (caratteri, dopo il trim). */
export const MAX_TEXT = {
  /** Id, slug, chiavi di prodotti e pasti. */
  key: 64,
  short: 40,
  name: 120,
  note: 2000,
  /** Introduzione del PT, passaggi delle ricette. */
  long: 4000,
  url: 2048,
} as const;

/** Numero massimo di elementi negli elenchi. */
export const MAX_ITEMS = {
  muscles: 10,
  warmup: 30,
  workoutItems: 60,
  setsPerItem: 20,
  categories: 50,
  products: 1000,
  dayTypes: 10,
  mealsPerDay: 12,
  itemsPerMeal: 40,
  supplementsPerDay: 30,
  recipes: 300,
  recipeSteps: 50,
  /** Righe per tabella nel backup. */
  rows: {
    profile: 1,
    measurements: 5000,
    exercises: 2000,
    workouts: 500,
    sessions: 20000,
    dietPlans: 200,
    dietLog: 10000,
    shopping: 2000,
    settings: 100,
  },
} as const;

/** Massimo di messaggi d'errore mostrati per un file non valido. */
export const MAX_ERROR_MESSAGES = 10;
