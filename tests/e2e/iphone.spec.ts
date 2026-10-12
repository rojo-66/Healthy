import { expect, test, type Locator, type Page } from '@playwright/test';

// Rifinitura iPhone 1: barra di navigazione, zoom, titoli dei gruppi, Stepper scritti a mano, swipe.
// Lunedì 12 ottobre 2026, 18:00: "Petto + Schiena" (3 esercizi) è la scheda di oggi.
const NOW = new Date(2026, 9, 12, 18, 0);
const BACKUP = 'tests/fixtures/home/backup-home.json';

async function loadBackup(page: Page) {
  await page.goto('./#/profilo');
  await page.getByTestId('backup-input').setInputFiles(BACKUP);
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await sheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(sheet).toBeHidden();
}

/** Trascina il dito (mouse) in orizzontale a passi, come un vero swipe. */
async function drag(page: Page, y: number, fromX: number, toX: number) {
  await page.mouse.move(fromX, y);
  await page.mouse.down();
  const step = fromX < toX ? 20 : -20;
  for (let x = fromX; step > 0 ? x <= toX : x >= toX; x += step) await page.mouse.move(x, y);
  await page.mouse.up();
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

const exerciseName = (page: Page) => page.getByRole('region', { name: 'Esercizio in corso' }).getByRole('heading', { level: 2 });

async function startSession(page: Page) {
  await page.goto('./#/allena');
  await page.getByRole('region', { name: 'Prossimo allenamento' }).getByRole('button', { name: 'Avvia' }).click();
  for (const label of ['Sonno', 'Umore', 'Energia', 'Stress', 'Affaticamento muscolare']) {
    await page.getByRole('button', { name: `${label}: 4 su 5` }).click();
  }
  await page.getByRole('button', { name: /^Avanti/ }).click();
  await page.getByRole('button', { name: 'Inizia allenamento' }).click();
  await expect(exerciseName(page)).toHaveText('Panca piana con bilanciere');
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

test('Stepper: numero scritto a mano con virgola, limiti, conferma e passo dal valore libero', async ({ page }) => {
  await page.goto('./#/showcase');
  const kg = page.getByRole('group', { name: 'Kg' });
  const field = kg.getByRole('spinbutton');
  await expect(field).toHaveAttribute('aria-valuenow', '72.5');
  await expect(field).toHaveAttribute('aria-valuemax', '300');

  // Tocco sul numero: diventa un campo con il testo selezionato, si sovrascrive subito.
  await field.click();
  await page.keyboard.type('22,5');
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('22,5');

  // Valore libero fuori passo: resta così, poi + prosegue col passo.
  await field.click();
  await page.keyboard.type('22');
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('22');
  await kg.getByRole('button', { name: 'Più 2,5 kg' }).click();
  await expect(field).toHaveValue('24,5');

  // Fuori limite: avviso e ritorno all'ultimo valido.
  await field.click();
  await page.keyboard.type('999');
  await page.keyboard.press('Enter');
  await expect(kg.getByRole('alert')).toHaveText('Valore tra 0 e 300 kg.');
  await expect(field).toHaveValue('24,5');

  // Valore sospetto: chiede conferma.
  await field.click();
  await page.keyboard.type('280');
  await page.locator('body').click({ position: { x: 5, y: 5 } }); // tocco fuori = conferma del campo
  await expect(kg.getByRole('alert')).toContainText('280 kg?');
  await kg.getByRole('button', { name: 'Conferma' }).click();
  await expect(field).toHaveValue('280');

  // Serie: solo interi.
  const sets = page.getByRole('group', { name: 'Serie' });
  await sets.getByRole('spinbutton').click();
  await page.keyboard.type('3.5');
  await page.keyboard.press('Enter');
  await expect(sets.getByRole('alert')).toHaveText('Solo numeri interi.');
  await expect(sets.getByRole('spinbutton')).toHaveValue('4');
});

test('Stepper: pressione lunga ripete accelerando e si ferma al rilascio', async ({ page }) => {
  await page.goto('./#/showcase');
  const reps = page.getByRole('group', { name: 'Ripetizioni' });
  const field = reps.getByRole('spinbutton');
  await expect(field).toHaveValue('10');
  await reps.scrollIntoViewIfNeeded();
  const plus = await center(reps.getByRole('button', { name: 'Più 1' }));
  await page.mouse.move(plus.x, plus.y);
  await page.mouse.down();
  await page.clock.runFor(1500);
  await page.mouse.up();
  const after = Number(await field.inputValue());
  expect(after).toBeGreaterThan(14);
  await page.clock.runFor(1500);
  await expect(field).toHaveValue(String(after));

  // Un tocco breve resta un passo solo.
  await reps.getByRole('button', { name: 'Più 1' }).click();
  await expect(field).toHaveValue(String(after + 1));

  // Al limite si ferma da sola (Serie: massimo 10).
  const sets = page.getByRole('group', { name: 'Serie' });
  await sets.scrollIntoViewIfNeeded();
  const more = await center(sets.getByRole('button', { name: 'Una serie in più' }));
  await page.mouse.move(more.x, more.y);
  await page.mouse.down();
  await page.clock.runFor(3000);
  await page.mouse.up();
  await expect(sets.getByRole('spinbutton')).toHaveValue('10');
});

test('sessione live: swipe tra gli esercizi, non dai campi, niente oltre l’ultimo', async ({ page }) => {
  await loadBackup(page);
  await startSession(page);
  const area = page.getByTestId('exercise-swipe');
  const { box } = await center(area);
  const y = box.y + 60;

  await drag(page, y, 320, 80);
  await expect(exerciseName(page)).toHaveText('Lat machine presa larga');
  await drag(page, y, 80, 320);
  await expect(exerciseName(page)).toHaveText('Panca piana con bilanciere');

  // Uno swipe che parte dal campo kg non cambia esercizio.
  const kgField = await center(page.getByLabel('Chili serie 1'));
  await drag(page, kgField.y, kgField.x, kgField.x - 200);
  await expect(exerciseName(page)).toHaveText('Panca piana con bilanciere');

  // Movimento verticale: niente cambio.
  await page.mouse.move(200, y);
  await page.mouse.down();
  for (let dy = 0; dy <= 200; dy += 20) await page.mouse.move(200 + dy / 10, y + dy);
  await page.mouse.up();
  await expect(exerciseName(page)).toHaveText('Panca piana con bilanciere');

  // Fino all'ultimo: lì lo swipe in avanti non fa niente e resta "Termina allenamento".
  await drag(page, y, 320, 80);
  await expect(exerciseName(page)).toHaveText('Lat machine presa larga');
  await drag(page, y, 320, 80);
  await expect(exerciseName(page)).toHaveText('Plank');
  await drag(page, y, 320, 40);
  await page.clock.runFor(500);
  await expect(exerciseName(page)).toHaveText('Plank');
  await expect(page.getByRole('button', { name: 'Termina allenamento' })).toBeVisible();
});

test('tab: swipe sul contenuto e sulla barra, l’indicatore segue; in Piano vince il giorno', async ({ page }) => {
  await loadBackup(page);

  // Allena: trascinando sulla barra delle tab si passa a Storico; sul contenuto si torna a Schede.
  await page.goto('./#/allena');
  const tabs = page.getByRole('tablist', { name: 'Sezioni' });
  const schede = page.getByRole('tab', { name: 'Schede' });
  const storico = page.getByRole('tab', { name: 'Storico' });
  const bar = await center(tabs);
  await drag(page, bar.y, 300, 60);
  await expect(storico).toHaveAttribute('aria-selected', 'true');
  const panel = await center(page.getByRole('tabpanel'));
  await drag(page, panel.box.y + 40, 80, 320);
  await expect(schede).toHaveAttribute('aria-selected', 'true');

  // Indicatore che segue il dito a metà gesto.
  const indicator = tabs.locator('.indicator');
  // Posizione di partenza (Schede): il bordo sinistro della barra (l'animazione precedente può essere in corso).
  const before = bar.box.x;
  await page.mouse.move(300, bar.y);
  await page.mouse.down();
  for (let x = 300; x >= 180; x -= 20) await page.mouse.move(x, bar.y);
  expect((await indicator.boundingBox())!.x).toBeGreaterThan(before + 30);
  await page.mouse.up();

  // Progressi: Corpo → Forza.
  await page.goto('./#/progressi');
  await expect(page.getByRole('tab', { name: 'Corpo' })).toHaveAttribute('aria-selected', 'true');
  const pbar = await center(page.getByRole('tablist', { name: 'Sezioni' }));
  await drag(page, pbar.y, 300, 60);
  await expect(page.getByRole('tab', { name: 'Forza' })).toHaveAttribute('aria-selected', 'true');

  // Dieta: in Piano lo swipe cambia giorno (non tab); in Spesa cambia tab.
  await page.goto('./#/dieta');
  const piano = page.getByRole('tab', { name: 'Piano' });
  await expect(piano).toHaveAttribute('aria-selected', 'true');
  const days = page.getByTestId('day-strip').getByRole('button');
  const pressedBefore = await days.evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-pressed') === 'true'));
  const strip = await center(page.getByTestId('day-strip'));
  await drag(page, strip.y, 320, 60);
  await expect(piano).toHaveAttribute('aria-selected', 'true');
  await expect(days.nth(pressedBefore + 1)).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('tab', { name: 'Spesa' }).click();
  const shop = await center(page.getByRole('tabpanel'));
  await drag(page, shop.box.y + 30, 320, 60);
  await expect(page.getByRole('tab', { name: 'Ricette' })).toHaveAttribute('aria-selected', 'true');
});

test('riga scheda: trascinando a sinistra compaiono Duplica ed Elimina', async ({ page }) => {
  await loadBackup(page);
  await page.goto('./#/allena');
  const row = page.getByTestId('workout-row').filter({ hasText: 'Gambe' });
  const duplicate = row.getByRole('button', { name: 'Duplica Gambe' });
  await expect(duplicate).toBeHidden();
  const r = await center(row);
  await drag(page, r.y, 300, 120);
  await expect(duplicate).toBeVisible();
  // Lo swipe sulla riga non cambia tab.
  await expect(page.getByRole('tab', { name: 'Schede' })).toHaveAttribute('aria-selected', 'true');

  await row.getByRole('button', { name: 'Elimina Gambe' }).click();
  await expect(page.getByRole('dialog', { name: 'Eliminare la scheda?' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Eliminare la scheda?' }).getByRole('button', { name: 'Annulla' }).click();
  await expect(duplicate).toBeHidden();
});

test('Nuova misura: i titoli dei gruppi stanno dentro i riquadri', async ({ page }) => {
  await page.goto('./#/profilo/misura');
  const groups = page.locator('fieldset.group');
  await expect(groups).toHaveCount(6);
  for (const group of await groups.all()) {
    const g = (await group.boundingBox())!;
    const l = (await group.locator('legend').boundingBox())!;
    expect(l.y).toBeGreaterThanOrEqual(g.y + 1);
    expect(l.y + l.height).toBeLessThanOrEqual(g.y + g.height);
    expect(l.x).toBeGreaterThanOrEqual(g.x + 1);
  }
});

test('barra di navigazione attaccata al fondo; con la tastiera si nasconde', async ({ page }) => {
  await page.goto('./#/');
  const dock = page.getByTestId('nav-dock');
  const nav = page.getByRole('navigation', { name: 'Navigazione principale' });
  await expect(nav).toBeVisible();
  const box = (await nav.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(844);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim())).toBe('844px');

  // Tastiera simulata: l'area visibile si restringe.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, get: () => 450 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(dock).toHaveAttribute('inert', '');
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, get: () => window.innerHeight });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(dock).not.toHaveAttribute('inert');
  await page.clock.runFor(600);
  // Ricompare scorrendo dal basso (transizione reale): si aspetta che torni al fondo.
  await expect.poll(async () => Math.round((await nav.boundingBox())!.y + box.height)).toBe(844);
});

test('nessun campo con testo sotto i 16 px (niente zoom al tocco)', async ({ page }) => {
  await loadBackup(page);
  const small: string[] = [];
  async function scan(where: string) {
    const found = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('input, textarea, select')]
        .filter((el) => !(el instanceof HTMLInputElement) || !['checkbox', 'radio', 'file', 'hidden', 'range', 'button'].includes(el.type))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => `${el.tagName.toLowerCase()}#${el.id || el.getAttribute('aria-label') || el.className} ${getComputedStyle(el).fontSize}`),
    );
    small.push(...found.map((f) => `${where}: ${f}`));
  }
  async function visit(hash: string, ready: Locator) {
    await page.goto(`./${hash}`);
    await expect(ready).toBeVisible();
    await scan(hash);
  }

  await visit('#/', page.getByTestId('home-swipe'));
  await visit('#/allena', page.getByRole('heading', { name: 'Allena', level: 1 }));
  await visit('#/dieta', page.getByRole('heading', { name: 'Dieta', level: 1 }));
  for (const tab of ['Spesa', 'Ricette']) {
    await page.getByRole('tab', { name: tab }).click();
    await scan(`#/dieta ${tab}`);
  }
  await visit('#/dieta/completa', page.getByRole('heading', { name: 'Completa il piano' }));
  await visit('#/progressi', page.getByRole('heading', { name: 'Progressi', level: 1 }));
  await visit('#/profilo', page.getByTestId('profile-facts'));
  await page.getByTestId('profile-facts').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await scan('#/profilo pannello profilo');
  await visit('#/profilo/misura', page.getByTestId('group-base'));
  await visit('#/importa', page.getByRole('heading', { level: 1 }).first());
  await visit('#/showcase', page.getByRole('heading', { name: 'Componenti' }));

  // Editor con un esercizio aperto e la libreria.
  await page.goto('./#/allena/editor');
  await expect(page.getByLabel('Nome della scheda')).toBeVisible();
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  const lib = page.getByRole('dialog', { name: 'Libreria' });
  await expect(lib.getByRole('status')).toContainText(/\d+ esercizi/);
  await scan('editor libreria');
  await lib.getByLabel('Cerca esercizio').fill('panca piana');
  await lib.getByRole('button', { name: 'Aggiungi Panca piana con bilanciere', exact: true }).click();
  await expect(lib).toBeHidden();
  await scan('#/allena/editor');

  // Sessione live.
  await startSession(page);
  await scan('#/sessione/live');

  expect(small).toEqual([]);
});
