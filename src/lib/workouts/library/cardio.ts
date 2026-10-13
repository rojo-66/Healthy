import type { CardioField } from '../../data/schemas/exercises';
import type { Equipment } from './muscles';
import { normalize } from './search';

/**
 * Esercizi cardio della libreria (2a), scritti a mano. Gli id `cd-…` sono pubblicati: non cambiano
 * e non spariscono (schede, sessioni e "ultima volta" li usano). `fields` = campi facoltativi
 * che l'editor mostra subito per quella voce (i minuti ci sono sempre).
 * `aliases`: nomi del vecchio "cardio finale" (testo libero, M4) che portano a questa voce nella migrazione.
 */
export interface CardioEntry {
  readonly id: string;
  readonly name: string;
  readonly equipment: Equipment;
  readonly fields: readonly CardioField[];
  readonly aliases?: readonly string[];
}

export const CARDIO_LIBRARY: readonly CardioEntry[] = [
  { id: 'cd-tapis-corsa', name: 'Tapis roulant · corsa', equipment: 'Macchina', fields: ['distance', 'speed', 'incline'], aliases: ['tapis roulant', 'tapis', 'treadmill'] },
  { id: 'cd-tapis-salita', name: 'Tapis roulant · camminata in salita', equipment: 'Macchina', fields: ['speed', 'incline'], aliases: ['camminata in salita'] },
  { id: 'cd-corsa-aperto', name: 'Corsa all’aperto', equipment: 'Corpo libero', fields: ['distance'], aliases: ['corsa', "corsa all'aperto"] },
  { id: 'cd-camminata-veloce', name: 'Camminata veloce', equipment: 'Corpo libero', fields: ['distance'] },
  { id: 'cd-camminata', name: 'Camminata', equipment: 'Corpo libero', fields: ['distance'] },
  { id: 'cd-cyclette', name: 'Cyclette', equipment: 'Macchina', fields: ['distance', 'level'] },
  { id: 'cd-bici', name: 'Bici all’aperto', equipment: 'Altro', fields: ['distance'], aliases: ['bici', 'bicicletta', "bici all'aperto"] },
  { id: 'cd-spinning', name: 'Spinning', equipment: 'Macchina', fields: ['level'] },
  { id: 'cd-ellittica', name: 'Ellittica', equipment: 'Macchina', fields: ['level'] },
  { id: 'cd-vogatore', name: 'Vogatore', equipment: 'Macchina', fields: ['distance', 'level'], aliases: ['rowing'] },
  { id: 'cd-stair-climber', name: 'Stair climber / Step machine', equipment: 'Macchina', fields: ['level'], aliases: ['stair climber', 'step machine'] },
  { id: 'cd-step', name: 'Step aerobico', equipment: 'Altro', fields: [], aliases: ['step'] },
  { id: 'cd-corda', name: 'Salto con la corda', equipment: 'Altro', fields: [], aliases: ['corda', 'salto della corda'] },
  { id: 'cd-nuoto', name: 'Nuoto', equipment: 'Altro', fields: ['distance'] },
  { id: 'cd-air-bike', name: 'Air bike', equipment: 'Macchina', fields: ['level'] },
  { id: 'cd-ski-erg', name: 'Ski erg', equipment: 'Macchina', fields: ['distance', 'level'] },
  { id: 'cd-ergometro-braccia', name: 'Ergometro per braccia', equipment: 'Macchina', fields: ['level'] },
  { id: 'cd-hiit', name: 'Circuito / HIIT', equipment: 'Corpo libero', fields: [], aliases: ['hiit', 'circuito'] },
];

/** Nome confrontabile: come `normalize`, con gli apostrofi tipografici uguali a quelli dritti. */
function cardioKey(name: string): string {
  return normalize(name).replace(/[’‘`]/g, "'");
}

const BY_NAME: ReadonlyMap<string, CardioEntry> = new Map(
  CARDIO_LIBRARY.flatMap((entry) => [entry.name, ...(entry.aliases ?? [])].map((n) => [cardioKey(n), entry] as const)),
);

/** Voce cardio della libreria con quel nome (o alias), maiuscole, accenti e apostrofi non contano. */
export function findCardioEntry(name: string): CardioEntry | null {
  return BY_NAME.get(cardioKey(name)) ?? null;
}
