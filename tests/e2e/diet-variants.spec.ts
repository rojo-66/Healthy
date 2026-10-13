import { expect, test, type Page } from '@playwright/test';

/**
 * Passo 2b: piano alimentare v3 con le varianti per tipo di giornata.
 * Lunedì 12 ottobre 2026, 13:00 (pranzo). Il piano finto ha lunedì palestra (in uso) + riposo.
 */
const NOW = new Date(2026, 9, 12, 13, 0);
const VARIANTS = 'tests/fixtures/diet-variants.json';
const CLAUDE_V3 = 'tests/fixtures/diet-claude-filled-v3.json';
const OLD_BACKUP = 'tests/fixtures/home/backup-home.json';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

const meal = (page: Page, label: string) => page.getByRole('article', { name: new RegExp(`^${label}:`) });
const chips = (page: Page) => page.getByTestId('variant-chips');

async function importVariants(page: Page) {
  await page.goto('./#/importa?da=dieta');
  await page.getByTestId('import-file').setInputFiles(VARIANTS);
  await expect(page.getByTestId('import-variants')).toHaveText('Lun · palestra + riposo; Ven · palestra + riposo');
  await page.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Piano .*: importa, esporta/ })).toContainText('Piano con varianti');
}

async function goOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await page.reload();
}

test('varianti del giorno: quella in uso con le spunte, le altre da consultare in sola lettura; anche offline', async ({ page }) => {
  await importVariants(page);
  await goOffline(page);

  // Lunedì: palestra in uso, riposo da consultare.
  await expect(chips(page).getByRole('button')).toHaveCount(2);
  await expect(chips(page).getByRole('button', { name: /Palestra · in uso/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(meal(page, 'Pranzo')).toContainText('Pollo e riso');
  await meal(page, 'Pranzo').getByRole('button', { name: 'Segna Pranzo come mangiato' }).click();
  await expect(meal(page, 'Pranzo').getByRole('button', { name: 'Pranzo mangiato, tocca per annullare' })).toBeVisible();

  await chips(page).getByRole('button', { name: /^Riposo/ }).click();
  await expect(page.getByTestId('variant-peek')).toContainText('Variante riposo · non è quella di oggi');
  await expect(meal(page, 'Pranzo')).toContainText('Insalata di pollo');
  // Sola lettura: niente spunte sulla variante consultata.
  await expect(page.getByRole('button', { name: /come mangiato|mangiato, tocca/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Riepilogo del giorno' })).toContainText('1.400');

  // Torna alla variante in uso: la spunta c'è ancora.
  await chips(page).getByRole('button', { name: /Palestra · in uso/ }).click();
  await expect(page.getByTestId('variant-peek')).toHaveCount(0);
  await expect(meal(page, 'Pranzo').getByRole('button', { name: 'Pranzo mangiato, tocca per annullare' })).toBeVisible();

  // Martedì ha una sola variante: niente chip. Cambiando giorno si torna sempre alla variante in uso.
  await page.getByTestId('day-strip').getByRole('button').nth(1).click();
  await expect(chips(page)).toHaveCount(0);
  await page.getByTestId('day-strip').getByRole('button').nth(4).click();
  await expect(chips(page).getByRole('button', { name: /Palestra · in uso/ })).toHaveAttribute('aria-pressed', 'true');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const box of await chips(page).getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(44);
  }
});

test('2c: lo scambio del giorno è stato sostituito dal tipo di giornata (niente comando)', async ({ page }) => {
  await importVariants(page);
  await expect(page.getByRole('button', { name: /Oggi seguo il piano di un altro giorno/ })).toHaveCount(0);
  // Senza schede né corse decide il piano: lunedì palestra, come prima.
  await expect(chips(page).getByRole('button', { name: /Palestra · in uso/ })).toHaveAttribute('aria-pressed', 'true');
});

test('dati di prima: un backup vecchio si ripristina con la stessa Dieta; il modello v3 compilato si importa', async ({ page }) => {
  await page.goto('./#/profilo');
  await page.getByTestId('backup-input').setInputFiles(OLD_BACKUP);
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await sheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(sheet).toBeHidden();
  await page.goto('./#/dieta');
  // Una variante per giorno: nessun chip, pasti come prima.
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(chips(page)).toHaveCount(0);

  await page.goto('./#/importa?da=dieta');
  await page.getByTestId('import-file').setInputFiles(CLAUDE_V3);
  await expect(page.getByTestId('import-variants')).toContainText('Lun · palestra + riposo');
  await expect(page.getByTestId('import-variants')).toContainText('Dom · palestra + riposo');
});
