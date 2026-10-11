import { expect, test, type Page } from '@playwright/test';

const TABLES = ['profile', 'measurements', 'exercises', 'workouts', 'sessions', 'dietPlans', 'dietLog', 'shopping', 'settings'];

test.beforeEach(async ({ page }) => {
  // Niente Web Share: il backup arriva come download, che Playwright può intercettare.
  await page.addInitScript(() => {
    for (const name of ['share', 'canShare']) {
      Object.defineProperty(Navigator.prototype, name, { value: undefined, configurable: true });
    }
  });
});

async function openDevData(page: Page) {
  await page.goto('./#/showcase');
  await page.getByRole('link', { name: 'Dati (prova)' }).click();
  await expect(page).toHaveURL(/#\/dev-data$/);
  await expect(page.getByRole('heading', { name: 'Dati', level: 1 })).toBeVisible();
}

const count = (page: Page, table: string) => page.getByTestId('counts').locator(`[data-table="${table}"]`);

async function readCounts(page: Page): Promise<Record<string, string>> {
  const entries = await Promise.all(TABLES.map(async (t) => [t, (await count(page, t).textContent()) ?? ''] as const));
  return Object.fromEntries(entries);
}

test('carica i dati di prova, esporta, svuota e reimporta il backup', async ({ page }) => {
  await openDevData(page);
  await expect(count(page, 'total')).toHaveText('0');

  await page.getByRole('button', { name: 'Carica dati di prova' }).click();
  await expect(count(page, 'total')).toHaveText('15');
  await expect(count(page, 'sessions')).toHaveText('3');
  const loaded = await readCounts(page);

  // Esporta → download
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^healthy-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  await expect(page.getByRole('status')).toContainText('Backup scaricato');
  await expect(page.getByText('Ultimo backup').locator('..')).not.toContainText('mai');

  // Svuota (con conferma)
  await page.getByRole('button', { name: 'Svuota tutto' }).click();
  const clearSheet = page.getByRole('dialog', { name: 'Svuotare tutto?' });
  await expect(clearSheet).toBeVisible();
  await clearSheet.getByRole('button', { name: 'Svuota' }).click();
  await expect(clearSheet).toBeHidden();
  await expect(count(page, 'total')).toHaveText('0');

  // Importa → anteprima → conferma
  await page.getByTestId('backup-input').setInputFiles(file);
  const importSheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await expect(importSheet).toBeVisible();
  await expect(importSheet).toContainText('15 elementi');
  await expect(importSheet.getByTestId('preview')).toContainText('Sessioni');
  await importSheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(importSheet).toBeHidden();
  await expect(count(page, 'total')).toHaveText('15');
  expect(await readCounts(page)).toEqual(loaded);

  // I dati restano dopo il ricaricamento.
  await page.reload();
  await expect(count(page, 'total')).toHaveText('15');
});

test('un file non valido mostra il motivo e non tocca i dati', async ({ page }) => {
  await openDevData(page);
  await page.getByRole('button', { name: 'Carica dati di prova' }).click();
  await expect(count(page, 'total')).toHaveText('15');

  await page.getByTestId('backup-input').setInputFiles('tests/fixtures/invalid/wrong-app.json');
  const note = page.getByRole('complementary', { name: 'Backup non valido: nessun dato modificato' });
  await expect(note).toContainText('Questo file non è stato creato da Healthy.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(count(page, 'total')).toHaveText('15');

  // Annullare l'anteprima lascia i dati come sono.
  await page.getByTestId('backup-input').setInputFiles('tests/fixtures/backup-valid.json');
  const importSheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await expect(importSheet).toBeVisible();
  await importSheet.getByRole('button', { name: 'Annulla' }).click();
  await expect(importSheet).toBeHidden();
  await expect(count(page, 'total')).toHaveText('15');
});

test('pagina dei dati: nessuno scroll orizzontale e controlli di almeno 44 px', async ({ page }) => {
  await openDevData(page);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a[href]')]
      .filter((el) => el.offsetParent !== null && !el.classList.contains('overlay'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.getAttribute('aria-label') ?? el.textContent?.trim(), w: r.width, h: r.height };
      })
      .filter((b) => b.w < 44 || b.h < 44),
  );
  expect(small).toEqual([]);
});
