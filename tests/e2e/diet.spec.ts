import { expect, test, type Page } from '@playwright/test';

// Lunedì 12 ottobre 2026, 13:00: il pranzo (finestra 12:00–13:30) è il pasto del momento.
const NOW = new Date(2026, 9, 12, 13, 0);
const EXTENDED = 'tests/fixtures/diet-extended.json';
const MYDIET = 'tests/fixtures/mydiet.json';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  // Niente Web Share: l'esportazione arriva come download, che Playwright può intercettare.
  await page.addInitScript(() => {
    for (const name of ['share', 'canShare']) {
      Object.defineProperty(Navigator.prototype, name, { value: undefined, configurable: true });
    }
  });
});

const summary = (page: Page) => page.getByRole('region', { name: 'Riepilogo del giorno' });
const strip = (page: Page) => page.getByTestId('day-strip').getByRole('button');
const meal = (page: Page, label: string) => page.getByRole('article', { name: new RegExp(`^${label}:`) });
const planButton = (page: Page) => page.getByRole('button', { name: /^Piano .*: importa, esporta/ });

async function importExtended(page: Page) {
  await page.goto('./#/dieta');
  await expect(page.getByRole('heading', { name: 'Nessun piano' })).toBeVisible();
  // M8: "Importa il tuo piano" apre la schermata unica di import (link, QR o file).
  await page.getByRole('link', { name: 'Importa il tuo piano' }).click();
  await page.getByTestId('import-file').setInputFiles(EXTENDED);
  await expect(page.getByTestId('import-preview')).toContainText('Giorni7');
  await page.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(planButton(page)).toContainText('Piano di esempio');
  await expect(page.getByRole('status').first()).toContainText('Piano «Piano di esempio» importato');
}

/** Un solo anello e un solo numero nel riepilogo, letti subito (anche durante le animazioni). */
async function ringSnapshot(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector('[aria-label="Riepilogo del giorno"]');
    const rings = card?.querySelectorAll('[role="img"]') ?? [];
    const values = card?.querySelectorAll('.value') ?? [];
    const lunches = document.querySelectorAll('article[aria-label^="Pranzo:"]').length;
    const box = rings[0]?.getBoundingClientRect();
    const inside = [...(card?.querySelectorAll('.value, .caption') ?? [])].every((el) => {
      const r = el.getBoundingClientRect();
      const fits = (el as HTMLElement).scrollWidth <= (el as HTMLElement).clientWidth;
      // Il testo sta nel foro: dentro il cerchio meno lo spessore del tratto (11 px).
      return !!box && fits && r.left >= box.left + 11 && r.right <= box.right - 11 && r.top >= box.top + 11 && r.bottom <= box.bottom - 11;
    });
    return { rings: rings.length, values: values.length, lunches, inside };
  });
}

test('importa il piano esteso e mostra il piano di oggi', async ({ page }) => {
  await importExtended(page);
  await expect(strip(page).nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(summary(page)).toContainText('Lunedì · oggi');
  await expect(summary(page)).toContainText('TARGET: NUTRIZIONISTA');
  await expect(summary(page)).toContainText('PIANO 1.605 kcal');
  await expect(meal(page, 'Pranzo')).toContainText('● ADESSO · PRANZO · 13:00');
  await expect(meal(page, 'Colazione')).not.toContainText('ADESSO');
  await expect(page.getByRole('complementary', { name: 'Nota del nutrizionista' })).toContainText('Cuoci 160 g di riso');
  await expect(page.getByRole('complementary', { name: "Osservazione dell'app" })).toContainText(
    "L'app non modifica il piano: segnala soltanto.",
  );
  await expect(page.getByRole('region', { name: 'Integratori' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText('Omega-3 · 1 capsula · cena')).toHaveCSS('text-decoration-line', 'line-through');

  // Spunta "mangiato": l'anello passa alle kcal mangiate, e resta dopo il ricaricamento.
  const ring = summary(page).getByRole('img');
  await expect(ring).toHaveAttribute('aria-label', '0 kcal mangiate su 1.800 di target');
  await meal(page, 'Pranzo').getByRole('button', { name: 'Segna Pranzo come mangiato' }).click();
  await expect(ring).toHaveAttribute('aria-label', '567 kcal mangiate su 1.800 di target');
  await expect(meal(page, 'Pranzo')).not.toContainText('ADESSO');
  await page.reload();
  await expect(summary(page).getByRole('img')).toHaveAttribute('aria-label', '567 kcal mangiate su 1.800 di target');

  // Gli altri giorni non hanno spunte e mostrano le kcal del piano.
  await strip(page).nth(1).click();
  await expect(summary(page)).toContainText('Martedì · anteprima');
  await expect(page.getByRole('button', { name: /come mangiato/ })).toHaveCount(0);
});

test('cambiando giorno più volte c’è sempre un solo anello, con il testo dentro il cerchio', async ({ page }) => {
  await importExtended(page);
  for (const i of [1, 2, 3, 4, 5, 6, 0, 3, 5, 2, 0]) {
    await strip(page).nth(i).click();
    expect(await ringSnapshot(page)).toEqual({ rings: 1, values: 1, lunches: 1, inside: true });
  }
  // Dopo le animazioni: sempre uno.
  await page.waitForTimeout(700);
  expect(await ringSnapshot(page)).toMatchObject({ rings: 1, values: 1, inside: true });

  // Swipe: il contenuto segue il dito e cambia giorno.
  const area = page.getByTestId('day-swipe');
  const box = (await area.boundingBox())!;
  const y = box.y + 150;
  await strip(page).nth(0).click();
  await page.mouse.move(box.x + 320, y);
  await page.mouse.down();
  for (let x = 320; x >= 100; x -= 20) await page.mouse.move(box.x + x, y);
  await page.mouse.up();
  await expect(strip(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
  expect(await ringSnapshot(page)).toMatchObject({ rings: 1, values: 1, inside: true });

  await page.mouse.move(box.x + 60, y);
  await page.mouse.down();
  for (let x = 60; x <= 300; x += 20) await page.mouse.move(box.x + x, y);
  await page.mouse.up();
  await expect(strip(page).nth(0)).toHaveAttribute('aria-pressed', 'true');

  // Oltre lunedì non si va.
  await page.mouse.move(box.x + 60, y);
  await page.mouse.down();
  for (let x = 60; x <= 300; x += 20) await page.mouse.move(box.x + x, y);
  await page.mouse.up();
  await expect(strip(page).nth(0)).toHaveAttribute('aria-pressed', 'true');
});

test('2c: "Oggi seguo il piano di un altro giorno" non c’è più: la Dieta segue il tipo di giornata; link al calendario', async ({ page }) => {
  await importExtended(page);
  await expect(page.getByRole('button', { name: /Oggi seguo il piano di un altro giorno/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Spostamenti e calendario →' })).toHaveAttribute('href', /#\/calendario\?giorno=2026-10-12/);
});

test('"Ricetta N" apre la ricetta giusta nella tab Ricette', async ({ page }) => {
  await importExtended(page);
  await meal(page, 'Pranzo').getByRole('button', { name: 'Ricetta 2' }).click();
  await expect(page.getByRole('tab', { name: 'Ricette' })).toHaveAttribute('aria-selected', 'true');
  const head = page.getByRole('button', { name: /Pollo, riso e zucchine/ });
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: /Pasta al tonno/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Bolli il riso 12-15 minuti.')).toBeInViewport();

  // Fisarmonica: una ricetta aperta alla volta.
  await page.getByRole('button', { name: /Pasta al tonno/ }).click();
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('complementary', { name: 'Consiglio' })).toContainText('tonno al naturale');
});

test('Spesa: somme della settimana, spunte salvate, "Spesa finita" con conferma', async ({ page }) => {
  await importExtended(page);
  await page.getByRole('tab', { name: 'Spesa' }).click();
  await expect(page.getByRole('heading', { name: 'Settimana 12–18 ott' })).toBeVisible();
  await expect(page.getByLabel('0 su 12 prodotti spuntati')).toBeVisible();
  await expect(page.getByText('Esclusi dalla lista: Proteine whey (integratori) e Pizza margherita (pasto libero).')).toBeVisible();

  const pollo = page.getByRole('button', { name: 'Petto di pollo, 900 g' });
  const uova = page.getByRole('button', { name: 'Uova, 11' });
  await pollo.click();
  await uova.click();
  await expect(pollo).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('2 su 12 prodotti spuntati')).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: 'Spesa' }).click();
  await expect(page.getByLabel('2 su 12 prodotti spuntati')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Petto di pollo, 900 g' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Spesa finita ✓' }).click();
  const confirm = page.getByRole('dialog', { name: 'Spesa finita?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Sì, togli le spunte' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByLabel('0 su 12 prodotti spuntati')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Petto di pollo, 900 g' })).toHaveAttribute('aria-pressed', 'false');
});

test('MyDiet: import, archivio e ripristino, doppione, completamento guidato', async ({ page }) => {
  await importExtended(page);

  // Import dal pannello: il piano esteso va in archivio.
  await planButton(page).click();
  const panel = page.getByRole('dialog', { name: 'Piano di esempio' });
  await expect(panel).toContainText('Completo al 100%');
  await panel.getByRole('link', { name: /^Importa/ }).click();
  await page.getByTestId('import-file').setInputFiles(MYDIET);
  await expect(page.getByLabel('Titolo')).toHaveValue('Ottobre 2026');
  await expect(page.getByRole('article', { name: 'Anteprima del piano' })).toContainText('14 alimenti senza valori nutrizionali');
  await page.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(planButton(page)).toContainText('Ottobre 2026');
  await expect(summary(page)).toContainText('TARGET: MANCANTE');
  await expect(page.getByRole('complementary', { name: 'Piano da completare' })).toContainText('allo 0%');
  await page.getByRole('tab', { name: 'Ricette' }).click();
  await expect(page.getByText('Nessuna ricetta nel piano. Il file di MyDiet non contiene ricette.')).toBeVisible();

  // Ripristino dall'archivio.
  await planButton(page).click();
  const mydietPanel = page.getByRole('dialog', { name: 'Ottobre 2026' });
  await expect(mydietPanel).toContainText('Da MyDiet · importato il 12 ott · v1');
  await mydietPanel.getByRole('button', { name: 'Ripristina Piano di esempio' }).click();
  await expect(planButton(page)).toContainText('Piano di esempio');

  // Lo stesso file MyDiet di nuovo: stessa versione → solo "Salva come copia".
  await page.goto('./#/importa?da=dieta');
  await page.getByTestId('import-file').setInputFiles(MYDIET);
  await expect(page.getByTestId('version-notice')).toContainText('nella stessa versione (v1)');
  await expect(page.getByRole('button', { name: 'Importa', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sostituisci' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Salva come copia' }).click();
  await expect(planButton(page)).toContainText('Ottobre 2026 (copia)');

  // Completamento guidato.
  await page.goto('./#/dieta/completa');
  const pct = page.getByTestId('completeness');
  await expect(pct).toHaveText('allo 0%');
  await page.getByRole('group', { name: 'Tipo di giornata di lunedì' }).getByRole('button', { name: 'Palestra' }).click();
  await expect(pct).toHaveText('al 4%');

  const pollo = page.locator('[data-product="Petto di pollo"]');
  await pollo.getByLabel('Kcal').fill('110');
  await pollo.getByLabel('Proteine').fill('23');
  await pollo.getByLabel('Carboidrati').fill('0');
  await pollo.getByLabel('Grassi').fill('1,5');
  await pollo.getByRole('button', { name: 'Salva i valori di Petto di pollo' }).click();
  await expect(page.getByRole('status')).toHaveText('Valori di Petto di pollo salvati.');
  await expect(pct).toHaveText('al 9%');

  const targets = page.locator('[data-day-type="Palestra"]');
  await expect(targets).toContainText('Stima non disponibile: mancano età, altezza, peso e sesso.');
  await expect(targets.getByRole('link', { name: 'Completa il Profilo' })).toHaveAttribute('href', '#/profilo');
  await targets.getByLabel('Kcal').fill('abc');
  await targets.getByRole('button', { name: 'Salva i target di Palestra' }).click();
  await expect(targets.getByRole('alert')).toContainText('«abc» non è un numero');
  await targets.getByLabel('Kcal').fill('1800');
  await targets.getByRole('button', { name: 'Salva i target di Palestra' }).click();
  await expect(pct).toHaveText('al 13%');

  await page.getByRole('link', { name: 'Torna alla dieta' }).click();
  await expect(summary(page)).toContainText('TARGET: INSERITO DA TE');
  await expect(summary(page)).toContainText('Palestra');
});

test('esporta il piano come file .json; un file non valido non tocca i dati', async ({ page }) => {
  await importExtended(page);
  await planButton(page).click();
  const panel = page.getByRole('dialog', { name: 'Piano di esempio' });
  const downloading = page.waitForEvent('download');
  await panel.getByRole('button', { name: /Esporta/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('healthy-dieta-piano-di-esempio.json');
  await expect(panel.getByRole('status')).toContainText('File scaricato');

  await panel.getByRole('button', { name: 'Chiudi' }).last().click();

  // Un file non valido: errori in italiano, nessuna anteprima, nessun dato toccato.
  await page.goto('./#/importa?da=dieta');
  await page.getByTestId('import-file').setInputFiles('tests/fixtures/invalid/mydiet-bad.json');
  const note = page.getByRole('complementary', { name: 'Non importato' });
  await expect(note).toContainText('unità: valore non ammesso');
  await expect(page.getByTestId('import-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(planButton(page)).toContainText('Piano di esempio');
});

test('dopo l’import la Dieta funziona offline', async ({ page, context }) => {
  await importExtended(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(planButton(page)).toContainText('Piano di esempio');
  await expect(meal(page, 'Pranzo')).toContainText('Pollo, riso e zucchine');
  await page.getByRole('tab', { name: 'Spesa' }).click();
  await expect(page.getByRole('button', { name: 'Petto di pollo, 900 g' })).toBeVisible();
  await page.getByRole('tab', { name: 'Ricette' }).click();
  await expect(page.getByRole('button', { name: /Pasta al tonno/ })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
});

test('Dieta: nessuno scroll orizzontale e controlli di almeno 44 px', async ({ page }) => {
  await importExtended(page);
  const check = async () => {
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
  };
  await check();
  await page.getByRole('tab', { name: 'Spesa' }).click();
  await check();
  await page.getByRole('tab', { name: 'Ricette' }).click();
  await page.getByRole('button', { name: /Pasta al tonno/ }).click();
  await check();
  await planButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Piano di esempio' })).toBeVisible();
  await check();
});
