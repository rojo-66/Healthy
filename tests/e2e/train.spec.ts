import { expect, test, type Locator, type Page } from '@playwright/test';

// Lunedì 12 ottobre 2026, 13:00.
const NOW = new Date(2026, 9, 12, 13, 0);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

const rows = (page: Page) => page.getByTestId('exercise-row');
const toggle = (row: Locator) => row.locator('button[aria-expanded]');
const rowNames = (page: Page) => rows(page).locator('.name').allTextContents();
const strip = (page: Page) => page.getByTestId('week-strip').getByRole('button');
const library = (page: Page) => page.getByRole('dialog', { name: 'Libreria' });
const counters = (page: Page) => page.getByTestId('editor-counters');

async function openLibrary(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  const lib = library(page);
  await expect(lib).toBeVisible();
  await expect(lib.getByRole('status')).toContainText(/\d+ esercizi/);
  return lib;
}

async function addFromLibrary(page: Page, search: string, name: string, muscle?: string) {
  const lib = await openLibrary(page);
  if (muscle) await lib.getByRole('group', { name: 'Filtra per muscolo principale' }).getByRole('button', { name: muscle, exact: true }).click();
  await lib.getByLabel('Cerca esercizio').fill(search);
  await lib.getByRole('button', { name: `Aggiungi ${name}`, exact: true }).click();
  await expect(lib).toBeHidden();
}

/** Scheda nuova con nome, giorni L e G e due esercizi della libreria. */
async function createBasic(page: Page, name: string) {
  await page.goto('./#/allena/editor');
  await expect(page.getByTestId('version-badge')).toHaveText('NUOVA · v1');
  await page.getByLabel('Nome della scheda').fill(name);
  await page.getByRole('button', { name: 'Lunedì' }).click();
  await page.getByRole('button', { name: 'Giovedì' }).click();
  await addFromLibrary(page, 'panca piana', 'Panca piana con bilanciere');
  await addFromLibrary(page, 'lat machine', 'Lat machine presa larga', 'Dorsali');
}

async function saveAndBack(page: Page, expected: string | RegExp) {
  await page.getByRole('button', { name: 'Salva e invia' }).click();
  const saved = page.getByRole('dialog', { name: 'Scheda salvata' });
  await expect(saved).toContainText(expected);
  await expect(saved).toContainText('arriva con la condivisione');
  await saved.getByRole('button', { name: 'Torna alle schede' }).click();
  await expect(page.getByRole('heading', { name: 'Allena', level: 1 })).toBeVisible();
}

async function openActions(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: new RegExp(`^${name.replace(/[()+]/g, '\\$&')}:`) }).click();
  const sheet = page.getByRole('dialog', { name });
  await expect(sheet).toBeVisible();
  return sheet;
}

test('Allena vuota: invito a creare la prima scheda, Storico vuoto, Importa "in arrivo"', async ({ page }) => {
  await page.goto('./#/allena');
  await expect(page.getByRole('heading', { name: 'Nessuna scheda' })).toBeVisible();
  await expect(strip(page)).toHaveCount(7);
  await expect(page.getByTestId('day-detail')).toContainText('Lunedì · Riposo');

  await page.getByRole('button', { name: 'Importa una scheda da link, QR o file' }).click();
  const info = page.getByRole('dialog', { name: 'Importa una scheda' });
  await expect(info).toContainText('arrivano con la condivisione');
  await info.getByRole('button', { name: 'Ho capito' }).click();
  await expect(info).toBeHidden();

  await page.getByRole('tab', { name: 'Storico' }).click();
  await expect(page.getByText('Nessun allenamento ancora')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ottobre' })).toBeVisible();
  await expect(page.getByRole('listitem', { name: '12 ottobre, oggi: nessuna sessione' })).toBeVisible();

  await page.getByRole('tab', { name: 'Schede' }).click();
  await page.getByRole('link', { name: 'Crea la tua prima scheda' }).click();
  await expect(page.getByTestId('version-badge')).toHaveText('NUOVA · v1');
});

test('crea, modifica, riordina e salva una scheda; la ritrova offline; v1 → v2; duplica ed elimina', async ({ page, context }) => {
  await createBasic(page, 'Spinta e tirata');

  // ✓ sugli esercizi già nella scheda.
  const lib = await openLibrary(page);
  await lib.getByLabel('Cerca esercizio').fill('PÀNCA piana con bilanciere');
  await expect(lib.getByRole('button', { name: 'Panca piana con bilanciere è già nella scheda' })).toBeVisible();

  // Esercizio personalizzato, creato e aggiunto.
  await lib.getByRole('button', { name: "Non c'è? Crea esercizio personalizzato" }).click();
  const form = page.getByRole('dialog', { name: 'Nuovo esercizio' });
  await form.getByLabel("Nome dell'esercizio").fill('Crunch sul rullo');
  await form.getByRole('group', { name: 'Muscoli' }).getByRole('button', { name: 'Addominali' }).click();
  await form.getByRole('group', { name: 'Attrezzo' }).getByRole('button', { name: 'Altro', exact: true }).click();
  await form.getByRole('button', { name: 'Crea e aggiungi' }).click();
  await expect(form).toBeHidden();
  expect(await rowNames(page)).toEqual(['Panca piana con bilanciere', 'Lat machine presa larga', 'Crunch sul rullo']);
  await expect(counters(page)).toContainText('3 esercizi');
  await expect(counters(page)).toContainText('9 serie');

  // Serie, ripetizioni e kg sulla panca.
  const bench = rows(page).nth(0);
  await toggle(bench).click();
  await bench.getByRole('button', { name: 'Una serie in più' }).click();
  await bench.getByRole('button', { name: 'Una ripetizione in meno' }).click();
  await bench.getByRole('button', { name: 'Una ripetizione in meno' }).click();
  for (let i = 0; i < 24; i++) await bench.getByRole('button', { name: 'Più 2,5 kg' }).click();
  await expect(bench.locator('.sum')).toHaveText('4 × 8 · 60 kg · rec 90 s');
  await bench.getByRole('button', { name: 'Recupero 120 secondi' }).click();
  await expect(counters(page)).toContainText('10 serie');

  // Serie diverse tra loro: l'ultima più pesante.
  await bench.getByRole('switch', { name: /Serie diverse tra loro/ }).click();
  await bench.getByRole('button', { name: 'Serie 4, kg: più' }).click();
  await expect(bench.locator('.sum')).toHaveText('4 serie · 8 rip · 60–62,5 kg · rec 120 s');

  // Riordino con il pulsante Giù.
  await bench.getByRole('button', { name: /^↓ Giù/ }).click();
  await expect.poll(() => rowNames(page)).toEqual(['Lat machine presa larga', 'Panca piana con bilanciere', 'Crunch sul rullo']);

  // Riordino trascinando la maniglia (pressione lunga): il crunch in cima.
  await toggle(rows(page).nth(1)).click(); // chiude la riga aperta
  const grip = rows(page).nth(2).getByTestId('grip');
  const from = (await grip.boundingBox())!;
  const top = (await rows(page).nth(0).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.move(from.x + from.width / 2, top.y + 4, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect.poll(() => rowNames(page)).toEqual(['Crunch sul rullo', 'Lat machine presa larga', 'Panca piana con bilanciere']);

  // Anteprima con gli stessi dati.
  await page.getByRole('button', { name: 'Anteprima' }).click();
  const preview = page.getByRole('dialog', { name: 'Anteprima' });
  await expect(preview).toContainText('Spinta e tirata');
  await expect(preview.locator('.item-name')).toHaveText(['Crunch sul rullo', 'Lat machine presa larga', 'Panca piana con bilanciere']);
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();

  await saveAndBack(page, '«Spinta e tirata» salvata · v1.');
  const row = page.getByTestId('workout-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('TUA');
  await expect(row).toContainText('LUN · GIO');
  await expect(strip(page).nth(0)).toContainText('SPI');
  await expect(strip(page).nth(3)).toContainText('SPI');
  await expect(page.getByRole('region', { name: 'Prossimo allenamento' })).toContainText('Spinta e tirata');

  // Offline: la scheda resta dopo aver riaperto l'app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('workout-row')).toContainText('Spinta e tirata');
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // Modifica offline: v1 → v2, l'ordine resta quello salvato.
  await (await openActions(page, 'Spinta e tirata')).getByRole('button', { name: /^Modifica/ }).click();
  await expect(page.getByTestId('version-badge')).toHaveText('v1 → v2');
  expect(await rowNames(page)).toEqual(['Crunch sul rullo', 'Lat machine presa larga', 'Panca piana con bilanciere']);
  await expect(rows(page).nth(2).locator('.sum')).toHaveText('4 serie · 8 rip · 60–62,5 kg · rec 120 s');
  const lat = rows(page).nth(1);
  await toggle(lat).click();
  await lat.getByRole('button', { name: 'Una ripetizione in più' }).click();
  await saveAndBack(page, 'salvata · v1 → v2');
  await (await openActions(page, 'Spinta e tirata')).getByRole('button', { name: /^Modifica/ }).click();
  await expect(page.getByTestId('version-badge')).toHaveText('v2 → v3');
  await page.getByRole('button', { name: 'Torna alle schede' }).click();

  // Duplica (nuova scheda v1, senza giorni) ed elimina la copia con conferma.
  await (await openActions(page, 'Spinta e tirata')).getByRole('button', { name: /^Duplica/ }).click();
  await expect(page.getByRole('status').first()).toContainText('Creata «Spinta e tirata (copia)»');
  await expect(page.getByTestId('workout-row')).toHaveCount(2);
  await (await openActions(page, 'Spinta e tirata (copia)')).getByRole('button', { name: /^Elimina/ }).click();
  const confirm = page.getByRole('dialog', { name: 'Eliminare la scheda?' });
  await confirm.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByTestId('workout-row')).toHaveCount(1);
  await expect(page.getByTestId('workout-row')).toContainText('Spinta e tirata');
});

test('senza nome e senza esercizi non si salva: errori in italiano accanto ai campi', async ({ page }) => {
  await page.goto('./#/allena/editor');
  await page.getByRole('button', { name: 'Salva e invia' }).click();
  await expect(page.getByText('Nome: non può essere vuoto')).toBeVisible();
  await expect(page.getByText('aggiungi almeno un esercizio')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('2 campi da correggere');

  // Link video non https: errore accanto al campo.
  await page.getByLabel('Nome della scheda').fill('Prova');
  await addFromLibrary(page, 'plank', 'Plank');
  await rows(page).nth(0).getByLabel('▶ Link video').fill('http://example.com/v');
  await page.getByRole('button', { name: 'Salva e invia' }).click();
  await expect(page.getByText('indirizzo web non valido: deve iniziare con https://')).toBeVisible();
  await rows(page).nth(0).getByLabel('▶ Link video').fill('https://example.com/v');
  await expect(rows(page).nth(0).getByRole('link', { name: 'Apri il video ↗' })).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByRole('alert')).toBeHidden();
});

test('bozza: dopo una chiusura improvvisa si riprende; uscendo con modifiche chiede conferma', async ({ page }) => {
  await page.goto('./#/allena/editor');
  await page.getByLabel('Nome della scheda').fill('Bozza di prova');
  await page.getByRole('button', { name: 'Martedì' }).click();
  await page.waitForTimeout(700); // salvataggio automatico (400 ms)
  await page.reload();
  const ask = page.getByRole('dialog', { name: 'Riprendere la bozza?' });
  await expect(ask).toContainText('«Bozza di prova»');
  await ask.getByRole('button', { name: 'Riprendi la bozza' }).click();
  await expect(page.getByLabel('Nome della scheda')).toHaveValue('Bozza di prova');
  await expect(page.getByRole('button', { name: 'Martedì' })).toHaveAttribute('aria-pressed', 'true');

  // Allena segnala la bozza non salvata.
  await page.getByRole('button', { name: 'Torna alle schede' }).click();
  const exit = page.getByRole('dialog', { name: 'Modifiche non salvate' });
  await expect(exit).toBeVisible();
  await exit.getByRole('button', { name: 'Continua a modificare' }).click();
  await expect(exit).toBeHidden();
  await page.goto('./#/allena');
  await expect(page.getByRole('complementary', { name: 'Bozza non salvata' })).toContainText('Bozza di prova');
  await page.getByRole('link', { name: 'Riprendi la bozza' }).click();
  await expect(page.getByLabel('Nome della scheda')).toHaveValue('Bozza di prova');

  // Esci senza salvare: la bozza sparisce.
  await page.getByRole('button', { name: 'Torna alle schede' }).click();
  await page.getByRole('dialog', { name: 'Modifiche non salvate' }).getByRole('button', { name: 'Esci senza salvare' }).click();
  await expect(page.getByRole('heading', { name: 'Allena', level: 1 })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Bozza non salvata' })).toBeHidden();
});

test('Allena ed editor: nessuno scroll orizzontale e controlli di almeno 44 px', async ({ page }) => {
  const check = async () => {
    // Misure a pannelli fermi: durante l'entrata le altezze sono frazionarie.
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, a[href]')]
        .filter((el) => el.offsetParent !== null && !el.classList.contains('overlay') && !el.closest('[inert]'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { name: el.getAttribute('aria-label') ?? el.textContent?.trim(), w: r.width, h: r.height };
        })
        .filter((b) => b.w < 43.5 || b.h < 43.5),
    );
    expect(small).toEqual([]);
  };
  await createBasic(page, 'Una scheda dal nome lunghissimo che non va mai a capo');
  await check();
  // Il titolo resta su una riga.
  const title = page.getByLabel('Nome della scheda');
  expect(await title.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await toggle(rows(page).nth(0)).click();
  await rows(page).nth(0).getByRole('switch').click();
  await check();
  await openLibrary(page);
  await check();
  await page.keyboard.press('Escape');
  await saveAndBack(page, 'salvata · v1');
  await check();
  await page.getByRole('tab', { name: 'Storico' }).click();
  await check();
});

test('due schede nuove una dopo l’altra restano separate', async ({ page }) => {
  await createBasic(page, 'Prima');
  await saveAndBack(page, '«Prima» salvata · v1.');
  // Subito un'altra scheda nuova: l'editor parte vuoto, non è quello di prima.
  await page.goto('./#/allena/editor');
  await expect(page.getByTestId('version-badge')).toHaveText('NUOVA · v1');
  await expect(page.getByLabel('Nome della scheda')).toHaveValue('');
  await page.getByLabel('Nome della scheda').fill('Seconda');
  await addFromLibrary(page, 'squat con bilanciere', 'Squat con bilanciere');
  await saveAndBack(page, '«Seconda» salvata · v1.');
  await expect(page.getByTestId('workout-row')).toHaveCount(2);
});
