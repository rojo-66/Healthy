import { expect, test, type Page } from '@playwright/test';

/**
 * Passo 2c: calendario delle attività e dieta adattiva. Lunedì 12 ottobre 2026, 13:00.
 * Dati finti (backup del formato 1, migrato dall'app): Petto lun 18:00, Corsa lenta mer 07:00, Spalle ven 18:00;
 * piano a varianti (lun e ven palestra + riposo, mer corsa, gli altri riposo); diario di lunedì 5 (2 pasti su 5).
 */
const NOW = new Date(2026, 9, 12, 13, 0);
const BACKUP = 'tests/fixtures/calendar/backup-calendar.json';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

async function loadBackup(page: Page) {
  await page.goto('./#/profilo');
  await page.getByTestId('backup-input').setInputFiles(BACKUP);
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await sheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(sheet).toBeHidden();
}

async function goOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await page.reload();
}

const meal = (page: Page, label: string) => page.getByRole('article', { name: new RegExp(`^${label}:`) });
const chips = (page: Page) => page.getByTestId('variant-chips');
const dayType = (page: Page) => page.getByTestId('day-type');
const cell = (page: Page, date: string) => page.locator(`[data-date="${date}"]`);
const detail = (page: Page) => page.getByTestId('calendar-detail');
const days = (page: Page) => page.getByTestId('move-days');
const summary = (page: Page) => page.getByTestId('move-summary');
const confirm = (page: Page) => page.getByRole('button', { name: 'Conferma' });
const toast = (page: Page) => page.getByTestId('undo-toast');

/** Dal calendario: tocca il giorno, poi "Sposta" (o un'altra azione) sull'attività indicata. */
async function act(page: Page, date: string, activity: string, action: 'Sposta' | 'Salta' | 'Ripristina') {
  await cell(page, date).click();
  const row = detail(page).getByRole('listitem').filter({ hasText: activity });
  await row.getByRole('button', { name: action }).click();
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('sposto l’allenamento di oggi a domani: oggi diventa riposo, i pasti segnati restano; Annulla torna indietro', async ({ page }) => {
  await loadBackup(page);
  // Prima segno la colazione (variante palestra).
  await page.goto('./#/dieta');
  await meal(page, 'Colazione').getByRole('button', { name: 'Segna Colazione come mangiato' }).click();
  await expect(meal(page, 'Colazione')).toContainText('Yogurt e avena');

  await page.goto('./#/');
  await expect(dayType(page)).toHaveText('Giorno palestra');
  await page.getByRole('button', { name: 'Non posso oggi' }).click();
  await page.getByRole('dialog', { name: 'Petto' }).getByRole('button', { name: 'Sposta' }).click();
  for (const h of await days(page).getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(h).toBeGreaterThanOrEqual(44);
  }
  await expect(days(page).getByRole('button', { name: /^Lunedì 12/ })).toBeDisabled();
  await days(page).getByRole('button', { name: /^Martedì 13/ }).click();
  await expect(summary(page)).toHaveText('Petto → mar 13');
  await expect(page.getByTestId('diet-impact')).toContainText('lun 12: palestra → riposo');
  await expect(page.getByTestId('diet-impact')).toContainText('i pasti già segnati restano');
  await confirm(page).click();
  await expect(toast(page)).toContainText('Spostamenti salvati');
  await expect(dayType(page)).toHaveText('Riposo');

  // "Annulla" per qualche secondo: torna come prima.
  await toast(page).getByRole('button', { name: 'Annulla' }).click();
  await expect(dayType(page)).toHaveText('Giorno palestra');

  // Di nuovo, e questa volta resta: la Dieta di oggi segue (variante riposo), la colazione segnata resta.
  await page.getByRole('button', { name: 'Non posso oggi' }).click();
  await page.getByRole('dialog', { name: 'Petto' }).getByRole('button', { name: 'Sposta' }).click();
  await days(page).getByRole('button', { name: /^Martedì 13/ }).click();
  await confirm(page).click();
  await expect(dayType(page)).toHaveText('Riposo');
  await page.goto('./#/dieta');
  await expect(chips(page).getByRole('button', { name: /Riposo · in uso/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(meal(page, 'Colazione')).toContainText('Yogurt e avena');
  await expect(meal(page, 'Colazione').getByRole('button', { name: 'Colazione mangiato, tocca per annullare' })).toBeVisible();
  await expect(meal(page, 'Pranzo')).toContainText('Insalata di pollo');
  await expect(page.getByRole('button', { name: /Oggi seguo il piano/ })).toHaveCount(0);
});

test('giorno occupato: "Scambia", poi "Sposta l’altra" in catena; "Ripristina la settimana"', async ({ page }) => {
  await loadBackup(page);
  await page.goto('./#/calendario');
  await expect(page.getByTestId('calendar-grid').getByRole('button')).toHaveCount(21);

  await act(page, '2026-10-12', 'Petto', 'Sposta');
  await days(page).getByRole('button', { name: /^Mercoledì 14/ }).click();
  const options = page.getByTestId('conflict-options');
  await expect(options.getByRole('button')).toHaveText([
    'Scambia i due giorni',
    "Sposta l'altra",
    "Salta l'altra",
    'Fai entrambe nello stesso giorno',
    'Annulla',
  ]);
  await options.getByRole('button', { name: 'Scambia i due giorni' }).click();
  await expect(summary(page).getByRole('listitem')).toHaveText(['Petto → mer 14', 'Corsa lenta → lun 12']);
  await confirm(page).click();
  await expect(cell(page, '2026-10-14')).toContainText('→PET');
  await expect(cell(page, '2026-10-12')).toContainText('→COR');

  // Catena: Spalle va a mercoledì (dove ora c'è Petto), Petto va a sabato. I giorni già usati non si scelgono.
  await act(page, '2026-10-16', 'Spalle', 'Sposta');
  await days(page).getByRole('button', { name: /^Mercoledì 14/ }).click();
  await page.getByTestId('conflict-options').getByRole('button', { name: "Sposta l'altra" }).click();
  await expect(days(page).getByRole('button', { name: /^Venerdì 16/ })).toBeDisabled();
  await expect(days(page).getByRole('button', { name: /^Mercoledì 14/ })).toBeDisabled();
  await days(page).getByRole('button', { name: /^Sabato 17/ }).click();
  await expect(summary(page).getByRole('listitem')).toHaveText(['Spalle → mer 14', 'Petto → sab 17']);
  await confirm(page).click();
  await expect(cell(page, '2026-10-17')).toContainText('→PET');
  await expect(cell(page, '2026-10-14')).toContainText('→SPA');

  // Ripristina la settimana: tutto torna come nel piano.
  await page.getByRole('button', { name: /Ripristina la settimana del lun 12/ }).click();
  await confirm(page).click();
  await expect(cell(page, '2026-10-12')).toContainText('PET');
  await expect(cell(page, '2026-10-12')).not.toContainText('→');
  await expect(cell(page, '2026-10-14')).toContainText('COR');
  await expect(cell(page, '2026-10-16')).toContainText('SPA');
  await noHorizontalScroll(page);
});

test('salto una corsa: resta barrata e conta come non fatta; la dieta di quel giorno torna riposo; Ripristina', async ({ page }) => {
  await loadBackup(page);
  await page.goto('./#/calendario');
  await act(page, '2026-10-14', 'Corsa lenta', 'Salta');
  await expect(summary(page)).toHaveText('Corsa lenta saltata (mer 14)');
  await expect(page.getByTestId('diet-impact')).toContainText('mer 14: corsa → riposo');
  await confirm(page).click();
  await expect(detail(page)).toContainText('saltata');
  await expect(cell(page, '2026-10-14').locator('.tag.skipped')).toHaveText('COR');

  await act(page, '2026-10-14', 'Corsa lenta', 'Ripristina');
  await confirm(page).click();
  await expect(detail(page)).toContainText('in programma');
});

test('palestra e corsa nello stesso giorno: scelgo la dieta (di base palestra)', async ({ page }) => {
  await loadBackup(page);
  await page.goto('./#/calendario');
  await act(page, '2026-10-14', 'Corsa lenta', 'Sposta');
  await days(page).getByRole('button', { name: /^Lunedì 12/ }).click();
  await page.getByTestId('conflict-options').getByRole('button', { name: 'Fai entrambe nello stesso giorno' }).click();
  await confirm(page).click();

  await page.goto('./#/');
  const choice = page.getByTestId('diet-choice');
  await expect(page.getByText('Oggi hai palestra e corsa')).toBeVisible();
  await expect(choice.getByRole('button', { name: /Dieta palestra/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(dayType(page)).toHaveText('Giorno palestra');
  await choice.getByRole('button', { name: 'Dieta corsa' }).click();
  await expect(dayType(page)).toHaveText('Corsa');

  // Lunedì non ha la variante corsa: la Dieta usa i pasti di mercoledì (il giorno più vicino che ce l'ha).
  await page.goto('./#/dieta');
  await expect(page.getByTestId('diet-choice').getByRole('button', { name: 'Dieta corsa' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('si usano i pasti di mercoledì')).toBeVisible();
  await expect(meal(page, 'Colazione')).toContainText('Avena');
});

test('calendario di 3 settimane: attività, dieta, % dei pasti nei giorni passati; da Home e Allena', async ({ page }) => {
  await loadBackup(page);
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Calendario' }).click();
  await expect(page).toHaveURL(/#\/calendario\?giorno=2026-10-12/);
  await expect(page.getByRole('heading', { name: 'Settimana scorsa' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settimana prossima' })).toBeVisible();
  // Lunedì 5: Petto non fatto, 2 pasti su 5 segnati (40 %).
  await expect(cell(page, '2026-10-05')).toContainText('PET');
  await expect(cell(page, '2026-10-05')).toContainText('40%');
  await cell(page, '2026-10-05').click();
  await expect(detail(page)).toContainText('non fatto');
  await expect(detail(page)).toContainText('pasti 2/5');
  // Il giorno di oggi: tipo di dieta e azioni.
  await cell(page, '2026-10-12').click();
  await expect(detail(page)).toContainText('Giorno palestra');
  await expect(detail(page).getByRole('button', { name: 'Sposta' })).toBeVisible();
  for (const h of await page.getByTestId('calendar-grid').getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(h).toBeGreaterThanOrEqual(44);
  }
  await noHorizontalScroll(page);

  // Da Allena: il link porta al calendario e il pulsante indietro torna ad Allena.
  await page.goto('./#/allena');
  await page.getByRole('link', { name: 'Calendario · 3 settimane →' }).click();
  await expect(page).toHaveURL(/da=allena/);
  await page.getByRole('link', { name: 'Torna ad Allena' }).click();
  await expect(page).toHaveURL(/#\/allena$/);
});

test('Home: la striscia scorre tra settimana scorsa, questa e prossima', async ({ page }) => {
  await loadBackup(page);
  await page.goto('./#/');
  const zone = page.getByTestId('home-strip-swipe');
  const drag = async (dir: 'left' | 'right') => {
    const box = (await zone.boundingBox())!;
    const y = box.y + box.height / 2;
    const [from, to, step] = dir === 'left' ? [340, 80, -20] : [80, 340, 20];
    await page.mouse.move(from, y);
    await page.mouse.down();
    for (let x = from; dir === 'left' ? x >= to : x <= to; x += step) await page.mouse.move(x, y);
    await page.mouse.up();
  };
  await expect(page.getByTestId('home-week')).toHaveText('Questa settimana');
  await drag('left');
  await expect(page.getByTestId('home-week')).toHaveText('Settimana prossima');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lunedì');
  await expect(page.getByTestId('home-strip').getByRole('button').first()).toHaveAccessibleName(/^Lunedì 19/);
  await expect(page.getByRole('button', { name: 'Settimana successiva' })).toBeDisabled();
  // Oltre la finestra non si va.
  await drag('left');
  await expect(page.getByTestId('home-week')).toHaveText('Settimana prossima');
  await drag('right');
  await expect(page.getByTestId('home-week')).toHaveText('Questa settimana');
  await drag('right');
  await expect(page.getByTestId('home-week')).toHaveText('Settimana scorsa');
  await expect(page.getByText(/sola lettura/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settimana precedente' })).toBeDisabled();
  await page.getByRole('button', { name: 'Torna a oggi' }).click();
  await expect(page.getByTestId('home-week')).toHaveText('Questa settimana');
  await noHorizontalScroll(page);
});

test('tutto anche offline: sposto, il calendario e la Dieta si aggiornano e restano dopo il ricaricamento', async ({ page }) => {
  await loadBackup(page);
  await page.goto('./#/calendario');
  await goOffline(page);
  await act(page, '2026-10-12', 'Petto', 'Sposta');
  await days(page).getByRole('button', { name: /^Martedì 13/ }).click();
  await confirm(page).click();
  await expect(cell(page, '2026-10-13')).toContainText('→PET');
  await page.reload();
  await expect(cell(page, '2026-10-13')).toContainText('→PET');
  await page.goto('./#/');
  await expect(dayType(page)).toHaveText('Riposo');
});
