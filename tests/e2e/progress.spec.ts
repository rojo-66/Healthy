import { expect, test, type Page } from '@playwright/test';

// Lunedì 12 ottobre 2026, 10:00. 3 mesi di dati finti (tests/fixtures/progress/make-backup.mjs).
const NOW = new Date(2026, 9, 12, 10, 0);
const BACKUP = 'tests/fixtures/progress/backup-progress.json';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

/** Backup finto caricato con "Importa backup" del Profilo (anteprima e conferma). */
async function importBackup(page: Page) {
  await page.goto('./#/profilo');
  await page.getByTestId('backup-input').setInputFiles(BACKUP);
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await sheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(sheet).toBeHidden();
}

async function openProgress(page: Page) {
  await page.getByRole('link', { name: 'Progressi' }).click();
  await expect(page).toHaveURL(/#\/progressi$/);
  await expect(page.getByRole('heading', { name: 'Progressi', level: 1 })).toBeVisible();
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const period = (page: Page, name: string) => page.getByRole('group', { name: 'Periodo' }).getByRole('button', { name });
const tooltip = (page: Page, testid: string) => page.getByTestId(testid).getByTestId('chart-tooltip');

/** Grafici, tooltip e piccoli grafici presenti in questo istante (anche durante le animazioni). */
async function counts(page: Page) {
  return page.evaluate(() => ({
    charts: document.querySelectorAll('[aria-roledescription="grafico"]').length,
    tooltips: document.querySelectorAll('[data-testid="chart-tooltip"]').length,
    minis: document.querySelectorAll('.mini svg').length,
    heatmaps: document.querySelectorAll('[data-testid="heatmap"]').length,
    panels: document.querySelectorAll('[role="tabpanel"] > div').length,
  }));
}

const EXPECTED = {
  corpo: { charts: 1, tooltips: 1, minis: 13, heatmaps: 0, panels: 1 },
  forza: { charts: 2, tooltips: 2, minis: 0, heatmaps: 0, panels: 1 },
  dieta: { charts: 1, tooltips: 1, minis: 0, heatmaps: 1, panels: 1 },
};

async function noBrokenText(page: Page) {
  const text = await page.locator('.screen').innerText();
  expect(text).not.toMatch(/\bNaN\b|Infinity|undefined|\bnull\b/);
  await expect(page.getByText('SYNC OFFLINE')).toHaveCount(0);
}

async function goOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test('dai dati inseriti si vedono gli andamenti di corpo, forza e dieta', async ({ page }) => {
  await importBackup(page);
  await openProgress(page);
  await expect(page.getByTestId('progress-span')).toHaveText('DAL 13 LUG 2026 · 13 SETTIMANE DI DATI');
  await expect(tab(page, 'Corpo')).toHaveAttribute('aria-selected', 'true');

  // Corpo: peso, composizione (6 piccoli grafici), circonferenze (7 righe).
  await expect(page.getByTestId('weight-now')).toHaveText('88,8kg');
  await expect(page.getByTestId('weight-chart')).toHaveAttribute('aria-label', 'Peso: da 87,5 a 88,8 kg dal 17/07 al 09/10');
  await expect(page.getByTestId('composition').locator('.mini-card')).toHaveCount(6);
  await expect(page.getByTestId('circumferences').locator('li')).toHaveCount(7);
  await noBrokenText(page);

  // Forza: esercizio più frequente (panca), record con il valore precedente.
  await tab(page, 'Forza').click();
  await expect(page.getByTestId('exercise-title')).toHaveText('Panca piana con bilanciere');
  await expect(page.getByTestId('exercise-now')).toHaveText('77,5 × 6kg × rip');
  await expect(page.getByTestId('recent-records').locator('li').first()).toContainText('prima 75 kg');
  await expect(page.getByTestId('weeks-chart')).toBeVisible();
  await noBrokenText(page);

  // Dieta: aderenza dei giorni conclusi (oggi escluso), calendario, scarto, osservazione.
  await tab(page, 'Dieta').click();
  await expect(page.getByRole('group', { name: 'Periodo' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Aderenza al piano 82 per cento' })).toBeVisible();
  await expect(page.getByTestId('most-skipped')).toHaveText('Il più saltato: Pranzo (2 volte)');
  await expect(page.getByTestId('heatmap').locator('td.today')).toHaveCount(1);
  await expect(page.getByTestId('diet-observation')).toContainText("L'app non modifica il piano: segnala soltanto.");
  await noBrokenText(page);
});

test('cambio di periodo, tab ed esercizio più volte di fila: mai elementi duplicati', async ({ page }) => {
  await importBackup(page);
  await openProgress(page);
  const periods = ['4 sett', '3 mesi', 'Tutto'];
  for (let i = 0; i < 12; i++) {
    await period(page, periods[i % 3]!).click();
    expect(await counts(page)).toEqual(EXPECTED.corpo);
  }
  for (let i = 0; i < 4; i++) {
    for (const [name, key] of [
      ['Forza', 'forza'],
      ['Dieta', 'dieta'],
      ['Corpo', 'corpo'],
    ] as const) {
      await tab(page, name).click();
      expect(await counts(page)).toEqual(EXPECTED[key]);
      await page.waitForTimeout(50);
      expect(await counts(page)).toEqual(EXPECTED[key]);
    }
  }
  await tab(page, 'Forza').click();
  const chips = page.getByTestId('exercise-chips').getByRole('button');
  const n = await chips.count();
  expect(n).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < 10; i++) {
    await chips.nth(i % n).click();
    await expect(chips.nth(i % n)).toHaveAttribute('aria-pressed', 'true');
    expect(await counts(page)).toEqual(EXPECTED.forza);
    await page.getByRole('group', { name: 'Misura' }).getByRole('button', { name: i % 2 ? 'Carico' : 'Volume' }).click();
    expect(await counts(page)).toEqual(EXPECTED.forza);
  }
});

test('tocco, trascinamento e tastiera sul grafico: tooltip giusto e dentro il grafico', async ({ page }) => {
  await importBackup(page);
  await openProgress(page);
  const chart = page.getByTestId('weight-chart');
  const tip = tooltip(page, 'weight-chart');
  await expect(tip).toContainText('09/10');

  const box = (await chart.boundingBox())!;
  // Tocco a sinistra: primo punto.
  await page.mouse.click(box.x + 42, box.y + box.height / 2);
  await expect(tip).toContainText('17/07');
  await expect(tip).toContainText('prima misura');
  // Trascinamento orizzontale verso destra: il punto scelto segue il dito.
  await page.mouse.move(box.x + 42, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  const middle = await tip.textContent();
  expect(middle).not.toContain('17/07');
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(tip).toContainText('09/10');
  await expect(tip).toContainText('vs prima');

  // Il tooltip resta dentro il grafico.
  const tipBox = (await tip.boundingBox())!;
  expect(tipBox.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(box.x + box.width + 1);

  // Tastiera: Home, frecce, annuncio per lo screen reader.
  await chart.focus();
  await page.keyboard.press('Home');
  await expect(tip).toContainText('17/07');
  await page.keyboard.press('ArrowRight');
  await expect(tip).toContainText('24/07');
  await expect(chart.locator('xpath=following-sibling::p[@aria-live]')).toContainText('24/07');

  // Record personale nel tooltip della Forza (ultimo punto della panca).
  await tab(page, 'Forza').click();
  await expect(tooltip(page, 'exercise-chart')).toContainText('PR');
  // Settimana in corso nelle barre.
  await expect(tooltip(page, 'weeks-chart')).toContainText('1 su 3 · in corso');
});

test('ogni grafico ha la vista Tabella', async ({ page }) => {
  await importBackup(page);
  await openProgress(page);
  await page.getByRole('group', { name: 'Vista del peso' }).getByRole('button', { name: 'Tabella' }).click();
  await expect(page.getByTestId('weight-table').locator('tbody tr')).toHaveCount(11);
  await expect(page.getByTestId('weight-table').locator('tbody tr').first()).toContainText('09/10');
  await page.getByRole('group', { name: 'Vista della composizione' }).getByRole('button', { name: 'Tabella' }).click();
  await expect(page.getByRole('region', { name: 'Massa magra FFM' }).locator('tbody tr')).toHaveCount(3);
  await page.getByRole('group', { name: 'Vista delle circonferenze' }).getByRole('button', { name: 'Tabella' }).click();
  await expect(page.getByRole('region', { name: 'Vita' }).locator('tbody tr')).toHaveCount(4);

  await tab(page, 'Forza').click();
  await page.getByRole('group', { name: "Vista dell'esercizio" }).getByRole('button', { name: 'Tabella' }).click();
  await expect(page.getByTestId('exercise-table').locator('tbody tr').first()).toContainText('PR');
  await page.getByRole('group', { name: 'Vista delle settimane' }).getByRole('button', { name: 'Tabella' }).click();
  await expect(page.getByTestId('weeks-table').locator('tbody tr')).toHaveCount(14);

  await tab(page, 'Dieta').click();
  await page.getByRole('group', { name: 'Vista del calendario' }).getByRole('button', { name: 'Tabella' }).click();
  await expect(page.getByTestId('heatmap-table').locator('tbody tr')).toHaveCount(12);
  await page.getByRole('group', { name: 'Vista dello scarto' }).getByRole('button', { name: 'Tabella' }).click();
  await expect(page.getByTestId('deviation-table').locator('tbody tr')).toHaveCount(10);

  // Le scelte restano per la sessione: tornando su Corpo il peso è ancora in tabella.
  await tab(page, 'Corpo').click();
  await expect(page.getByTestId('weight-table')).toBeVisible();
});

test('Grafici del Profilo apre la tab Corpo; le scelte restano finché l\'app è aperta', async ({ page }) => {
  await importBackup(page);
  await openProgress(page);
  await tab(page, 'Forza').click();
  await period(page, '4 sett').click();
  await page.getByRole('link', { name: 'Oggi' }).click();
  await page.getByRole('link', { name: 'Progressi' }).click();
  await expect(tab(page, 'Forza')).toHaveAttribute('aria-selected', 'true');
  await expect(period(page, '4 sett')).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('link', { name: 'Profilo' }).click();
  await page.getByRole('link', { name: 'Grafici' }).click();
  await expect(page).toHaveURL(/#\/progressi\?tab=corpo$/);
  await expect(tab(page, 'Corpo')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('in arrivo')).toHaveCount(0);
});

test('stati vuoti: profilo senza dati, nessun piano, nessuna sessione', async ({ page }) => {
  await page.goto('./#/progressi');
  await expect(page.getByTestId('progress-span')).toHaveText('NESSUN DATO ANCORA');
  await expect(page.getByTestId('body-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: '+ Aggiungi una misura nel Profilo' })).toHaveAttribute('href', '#/profilo/misura');
  expect(await counts(page)).toMatchObject({ charts: 0, tooltips: 0, minis: 0 });
  await noBrokenText(page);

  await tab(page, 'Forza').click();
  await expect(page.getByTestId('strength-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vai ad Allena' })).toBeVisible();
  await noBrokenText(page);

  await tab(page, 'Dieta').click();
  await expect(page.getByTestId('diet-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Importa un piano' })).toHaveAttribute('href', '#/importa');
  await noBrokenText(page);
});

test('una misura sola: il punto e l\'invito, nessuna linea', async ({ page }) => {
  await page.goto('./#/profilo/misura');
  await page.getByLabel('Data').fill('2026-10-10');
  await page.locator('#ms-weightKg').fill('80,4');
  await page.getByRole('button', { name: 'Salva misura' }).click();
  await expect(page).toHaveURL(/#\/profilo$/);
  await openProgress(page);
  await expect(page.getByText("Con un'altra misura vedrai l'andamento.")).toBeVisible();
  await expect(page.getByTestId('weight-chart').locator('path.line')).toHaveCount(0);
  await expect(page.getByTestId('weight-chart').locator('circle.dot')).toHaveCount(1);
  await noBrokenText(page);
});

test('tutto funziona offline', async ({ page }) => {
  await importBackup(page);
  await openProgress(page);
  await goOffline(page);
  await expect(page.getByTestId('weight-chart')).toBeVisible();
  await period(page, '3 mesi').click();
  await tab(page, 'Forza').click();
  await expect(page.getByTestId('exercise-chart')).toBeVisible();
  const box = (await page.getByTestId('exercise-chart').boundingBox())!;
  await page.mouse.click(box.x + 50, box.y + box.height / 2);
  await expect(tooltip(page, 'exercise-chart')).toBeVisible();
  await tab(page, 'Dieta').click();
  await expect(page.getByTestId('heatmap')).toBeVisible();
  await noBrokenText(page);
});

for (const width of [390, 375]) {
  test(`${width} px: niente scroll orizzontale e aree toccabili ≥ 44 px su ogni tab`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await importBackup(page);
    await openProgress(page);
    for (const name of ['Corpo', 'Forza', 'Dieta']) {
      await tab(page, name).click();
      await page.waitForTimeout(350);
      const overflow = await page.locator('.screen .body').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, name).toBeLessThanOrEqual(0);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, a[href], [aria-roledescription="grafico"]')]
          .filter((el) => el.offsetParent !== null && !el.closest('.chips'))
          .map((el) => ({ el: el.textContent?.trim() || el.getAttribute('aria-label'), r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width < 44 || r.height < 44)
          .map(({ el }) => el),
      );
      expect(small, name).toEqual([]);
    }
    // I chip degli esercizi scorrono in orizzontale nel loro contenitore, ma sono alti 44 px.
    await tab(page, 'Forza').click();
    const chipHeights = await page.getByTestId('exercise-chips').getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    for (const h of chipHeights) expect(h).toBeGreaterThanOrEqual(44);
  });
}

test('"Riduci movimento": stessi contenuti, nessun doppione', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await importBackup(page);
  await openProgress(page);
  for (let i = 0; i < 6; i++) {
    await tab(page, 'Forza').click();
    expect(await counts(page)).toEqual(EXPECTED.forza);
    await tab(page, 'Corpo').click();
    expect(await counts(page)).toEqual(EXPECTED.corpo);
  }
});
