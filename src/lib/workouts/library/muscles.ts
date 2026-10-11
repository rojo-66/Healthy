/**
 * Liste chiuse della libreria esercizi (M4). Valgono per la libreria e per gli esercizi personalizzati;
 * nel database `muscles` resta testo libero, perché le schede importate possono usare altri nomi.
 * Se cambi queste liste aggiorna anche `scripts/library/build.mjs`.
 */
export const MUSCLES = [
  'Petto',
  'Dorsali',
  'Trapezi',
  'Spalle',
  'Bicipiti',
  'Tricipiti',
  'Avambracci',
  'Addominali',
  'Lombari',
  'Glutei',
  'Quadricipiti',
  'Femorali',
  'Adduttori',
  'Polpacci',
] as const;

export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  'Bilanciere',
  'Bilanciere EZ',
  'Manubri',
  'Macchina',
  'Multipower',
  'Cavi',
  'Corpo libero',
  'Kettlebell',
  'Elastico',
  'Palla medica',
  'Fitball',
  'Altro',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

export function isMuscle(value: string): value is Muscle {
  return (MUSCLES as readonly string[]).includes(value);
}

export function isEquipment(value: string): value is Equipment {
  return (EQUIPMENT as readonly string[]).includes(value);
}

/** Riga della libreria nel file generato: `[id, nome, muscoli (il primo è il principale), attrezzo]`. */
export type LibraryEntry = readonly [id: string, name: string, muscles: readonly Muscle[], equipment: Equipment];
