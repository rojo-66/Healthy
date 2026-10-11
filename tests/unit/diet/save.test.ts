// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackup } from '../../../src/lib/data/backup';
import { db } from '../../../src/lib/data/db';
import { ValidationError } from '../../../src/lib/data/errors';
import { setMealEaten, setSwap } from '../../../src/lib/data/repo/diet-log';
import {
  activateDietPlan,
  getActiveDietPlan,
  listArchivedDietPlans,
  listDietPlans,
  saveImportedPlan,
  updatePlanPayload,
} from '../../../src/lib/data/repo/diet-plans';
import { resetShopping, setShoppingChecked } from '../../../src/lib/data/repo/shopping';
import { parseDietImport } from '../../../src/lib/diet/import/detect';
import { setProductValues } from '../../../src/lib/diet/edit';
import { resetDb, validBackupJson } from '../data/helpers';
import { extendedFile, myDietJson } from './helpers';

const NOW = new Date('2026-10-11T08:00:00.000Z');
const LATER = new Date('2026-10-12T08:00:00.000Z');

function myDietFile() {
  const result = parseDietImport(myDietJson());
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value.file;
}

async function caught(promise: Promise<unknown>): Promise<ValidationError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error('Mi aspettavo un errore');
}

beforeEach(resetDb);

describe('salvataggio di un piano importato', () => {
  it('il nuovo piano diventa attivo, il precedente va in archivio (non cancellato)', async () => {
    const first = await saveImportedPlan(extendedFile(), 'file', 'new', NOW);
    expect(first).toMatchObject({ active: true, archived: false, importedAt: NOW.toISOString(), origin: 'file', version: 2 });
    expect(first.payload.recipes).toHaveLength(4);

    const second = await saveImportedPlan(myDietFile(), 'mydiet', 'new', LATER);
    expect((await getActiveDietPlan())!.id).toBe(second.id);
    const plans = await listDietPlans();
    expect(plans.map((p) => [p.id, p.active, p.archived])).toEqual([
      [second.id, true, false],
      [first.id, false, true],
    ]);
    expect((await listArchivedDietPlans()).map((p) => p.id)).toEqual([first.id]);
  });

  it('"Sostituisci" usa lo stesso id; "Salva come copia" crea un nuovo piano', async () => {
    await saveImportedPlan(extendedFile(), 'file', 'new', NOW);
    const newer = { ...extendedFile(), version: 3, title: 'Piano aggiornato' };
    const replaced = await saveImportedPlan(newer, 'file', 'replace', LATER);
    expect(await db.dietPlans.count()).toBe(1);
    expect(replaced).toMatchObject({ id: extendedFile().id, version: 3, title: 'Piano aggiornato', active: true });

    const copy = await saveImportedPlan(extendedFile(), 'file', 'copy', LATER, () => 'copia-1');
    expect(copy).toMatchObject({ id: 'copia-1', title: 'Piano di esempio (copia)', active: true });
    expect(await db.dietPlans.count()).toBe(2);
    expect((await db.dietPlans.get(extendedFile().id))!.archived).toBe(true);
  });

  it('il titolo della copia non supera il limite', async () => {
    const long = { ...extendedFile(), title: 'x'.repeat(120) };
    const copy = await saveImportedPlan(long, 'file', 'copy', NOW, () => 'copia-lunga');
    expect(copy.title).toHaveLength(120);
    expect(copy.title.endsWith(' (copia)')).toBe(true);
  });

  it('niente salvataggi parziali: id già presente o dati non validi lasciano tutto com’è', async () => {
    const first = await saveImportedPlan(extendedFile(), 'file', 'new', NOW);
    const duplicate = await caught(saveImportedPlan(extendedFile(), 'file', 'new', LATER));
    expect(duplicate.errors).toEqual(['Esiste già un piano con lo stesso identificativo («Piano di esempio»)']);

    const invalid = await caught(saveImportedPlan({ ...myDietFile(), title: '   ' }, 'mydiet', 'new', LATER));
    expect(invalid.errors).toEqual(['titolo: non può essere vuoto']);

    expect(await listDietPlans()).toEqual([first]);
  });

  it('"Ripristina" dall’archivio: torna attivo e quello attivo va in archivio', async () => {
    const first = await saveImportedPlan(extendedFile(), 'file', 'new', NOW);
    const second = await saveImportedPlan(myDietFile(), 'mydiet', 'new', LATER);
    await activateDietPlan(first.id);
    expect((await getActiveDietPlan())!.id).toBe(first.id);
    const byId = Object.fromEntries((await listDietPlans()).map((p) => [p.id, p]));
    expect(byId[first.id]).toMatchObject({ active: true, archived: false });
    expect(byId[second.id]).toMatchObject({ active: false, archived: true });
  });

  it('i piani senza data di validità compaiono nell’elenco', async () => {
    const noDate = { ...myDietFile(), validFrom: null };
    await saveImportedPlan(noDate, 'mydiet', 'new', NOW);
    expect(await listDietPlans()).toHaveLength(1);
  });

  it('completamento guidato: il contenuto si aggiorna con validazione', async () => {
    const plan = await saveImportedPlan(myDietFile(), 'mydiet', 'new', NOW);
    const values = { kcal: 110, protein: 23, carbs: 0, fat: 1.5, fiber: 0 };
    const updated = await updatePlanPayload(plan.id, setProductValues(plan.payload, 'pollo', values, null));
    expect(updated.payload.products.pollo!.per100).toEqual(values);

    const bad = setProductValues(plan.payload, 'pollo', { ...values, kcal: -1 }, null);
    const error = await caught(updatePlanPayload(plan.id, bad));
    expect(error.errors).toEqual(['piano › prodotti › «pollo» › valori per 100 g › kcal: valore troppo basso: minimo 0']);
    expect((await db.dietPlans.get(plan.id))!.payload.products.pollo!.per100).toEqual(values);
  });

  it('i backup salvati prima di M3 (senza i nuovi campi) restano validi', () => {
    const raw = validBackupJson() as { tables: { dietPlans: Record<string, unknown>[] } };
    expect(raw.tables.dietPlans[0]).not.toHaveProperty('importedAt');
    const result = parseBackup(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tables.dietPlans[0]).toMatchObject({ importedAt: null, origin: 'file' });
    expect(result.value.tables.dietPlans[0]!.payload.dayTypes.gym!.targetsSource).toBe('plan');
  });
});

describe('diario e spesa', () => {
  it('scambio del giorno: salvato, e le spunte si azzerano solo se il giorno seguito cambia', async () => {
    await setMealEaten('2026-10-12', 'p1', 'pranzo', true);
    let day = await setSwap('2026-10-12', 'p1', 4);
    expect(day).toEqual({ date: '2026-10-12', planId: 'p1', swappedFromWeekday: 4, eaten: {} });
    await setMealEaten('2026-10-12', 'p1', 'colazione', true);
    day = await setSwap('2026-10-12', 'p1', 4);
    expect(day.eaten).toEqual({ colazione: true });
    day = await setSwap('2026-10-12', 'p1', null);
    expect(day).toEqual({ date: '2026-10-12', planId: 'p1', swappedFromWeekday: null, eaten: {} });
  });

  it('spunte della spesa per settimana (lunedì) e "Spesa finita"', async () => {
    await setShoppingChecked('2026-10-12', 'pollo', true);
    await setShoppingChecked('2026-10-12', 'riso', true);
    await setShoppingChecked('2026-10-12', 'riso', false);
    expect(await db.shopping.get('2026-10-12')).toEqual({ weekStart: '2026-10-12', checked: { pollo: true, riso: false } });
    await resetShopping('2026-10-12');
    expect(await db.shopping.get('2026-10-12')).toEqual({ weekStart: '2026-10-12', checked: {} });
    await expect(setShoppingChecked('2026-10-13', 'pollo', true)).rejects.toBeInstanceOf(ValidationError);
  });
});
