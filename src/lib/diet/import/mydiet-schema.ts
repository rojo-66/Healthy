import { z } from 'zod';
import { MAX_ITEMS, MAX_TEXT } from '../../data/limits';
import { num, requiredText, safeKey, text } from '../../data/schemas/common';

/**
 * File esportato da MyDiet (`app: "dieta-e-spesa"`, `schemaVersion: 1`, SPEC § 8.3).
 * Tollerante come chiede la specifica: campi sconosciuti ignorati, pasti mancanti o vuoti ammessi,
 * categorie dei prodotti libere. Gli orari non validi non bloccano l'import: li scarta l'adattatore con un avviso.
 */

export const MYDIET_APP = 'dieta-e-spesa';
export const MYDIET_VERSION = 1;

const myDietProductSchema = z.object({
  nome: requiredText(MAX_TEXT.name),
  cat: text(MAX_TEXT.short).default(''),
  unita: z.enum(['g', 'pz', 'ml']),
  spesa: z.boolean().default(true),
});

const myDietItemSchema = z.object({ p: safeKey, q: num(0, 5000) });

const myDietMealSchema = z.object({
  nome: text(MAX_TEXT.name).default(''),
  items: z.array(myDietItemSchema).max(MAX_ITEMS.itemsPerMeal).default([]),
  abilita: z.string().max(10).optional(),
  fine: z.string().max(10).optional(),
});

const myDietDaySchema = z.object({
  nota: text(MAX_TEXT.note).default(''),
  pasti: z
    .record(safeKey, myDietMealSchema)
    .refine((meals) => Object.keys(meals).length <= MAX_ITEMS.mealsPerDay, `troppi pasti: massimo ${MAX_ITEMS.mealsPerDay}`)
    .default({}),
});

export const myDietFileSchema = z.object({
  app: z.literal(MYDIET_APP),
  schemaVersion: z.literal(MYDIET_VERSION),
  esportato: z.string().max(40).optional(),
  dieta: z.object({
    categorie: z.array(text(MAX_TEXT.short)).max(MAX_ITEMS.categories).default([]),
    prodotti: z
      .record(safeKey, myDietProductSchema)
      .refine((p) => Object.keys(p).length <= MAX_ITEMS.products, `troppi prodotti: massimo ${MAX_ITEMS.products}`),
    giorni: z.array(myDietDaySchema).min(1).max(7),
  }),
});

export type MyDietFile = z.infer<typeof myDietFileSchema>;
export type MyDietDiet = MyDietFile['dieta'];
