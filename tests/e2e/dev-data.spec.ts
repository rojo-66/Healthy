import { expect, test, type Page } from '@playwright/test';

// Pagina tecnica ridotta (M7): conteggi, dati di prova, "Svuota tutto". Backup e ripristino sono nel Profilo
// (tests/e2e/profile.spec.ts).

async function openDevData(page: Page) {
  await page.goto('./#/showcase');
  await page.getByRole('link', { name: 'Dati (prova)' }).click();
  await expect(page).toHaveURL(/#\/dev-data$/);
  await expect(page.getByRole('heading', { name: 'Dati', level: 1 })).toBeVisible();
}

const count = (page: Page, table: string) => page.getByTestId('counts').locator(`[data-table="${table}"]`);

test('carica i dati di prova, li sostituisce con conferma e svuota tutto', async ({ page }) => {
  await openDevData(page);
  await expect(count(page, 'total')).toHaveText('0');
  // Export e import non sono più qui.
  await expect(page.getByRole('button', { name: 'Esporta backup' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Profilo' }).first()).toBeVisible();

  // Database vuoto: i dati di prova entrano senza domande.
  await page.getByRole('button', { name: 'Carica dati di prova' }).click();
  await expect(count(page, 'total')).toHaveText('16');
  await expect(count(page, 'sessions')).toHaveText('3');

  // Con dati presenti chiede conferma con l'anteprima.
  await page.getByRole('button', { name: 'Carica dati di prova' }).click();
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await expect(sheet).toContainText('Dati di prova, 16 elementi');
  await sheet.getByRole('button', { name: 'Annulla' }).click();
  await expect(sheet).toBeHidden();
  await expect(count(page, 'total')).toHaveText('16');

  await page.getByRole('button', { name: 'Svuota tutto' }).click();
  const clearSheet = page.getByRole('dialog', { name: 'Svuotare tutto?' });
  await clearSheet.getByRole('button', { name: 'Svuota' }).click();
  await expect(clearSheet).toBeHidden();
  await expect(count(page, 'total')).toHaveText('0');

  await page.reload();
  await expect(count(page, 'total')).toHaveText('0');
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
