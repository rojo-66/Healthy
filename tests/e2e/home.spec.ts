import { expect, test, type Page } from '@playwright/test';

// Lunedì 12 ottobre 2026, 13:00: pranzo (12:00–13:30) è il pasto del momento, "Petto + Schiena" alle 18:00.
const NOW = new Date(2026, 9, 12, 13, 0);
const BACKUP = 'tests/fixtures/home/backup-home.json';
const WORKOUTS_ONLY = 'tests/fixtures/home/backup-workouts-only.json';
const EXTENDED = 'tests/fixtures/diet-extended.json';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

/** Dati finti caricati dalla pagina Dati (percorso vero: validazione e ripristino), poi la Home. */
async function loadBackup(page: Page, file = BACKUP) {
  await page.goto('./#/dev-data');
  await page.getByTestId('backup-input').setInputFiles(file);
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await sheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(sheet).toBeHidden();
  await page.goto('./#/');
  await expect(page.getByTestId('home-swipe')).toBeVisible();
}

/** App "installata": display-mode standalone e storage persistente (come su iPhone dopo "Aggiungi a Home"). */
async function emulateInstalled(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone') ? ({ ...original(query), matches: true } as MediaQueryList) : original(query);
    const storage = navigator.storage as StorageManager;
    storage.persisted = async () => true;
    storage.persist = async () => true;
  });
}

async function goOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

const ring = (page: Page) => page.getByRole('region', { name: 'Calorie e macro' }).getByRole('img');
const mealCard = (page: Page) => page.getByRole('region', { name: 'Pasto del momento' });
const timelineRow = (page: Page, text: string) => page.getByTestId('timeline').getByRole('listitem').filter({ hasText: text });
const strip = (page: Page) => page.getByTestId('home-strip').getByRole('button');
const title = (page: Page) => page.getByRole('heading', { level: 1 });

/** Elementi della Home contati subito (anche durante le animazioni): mai doppioni. */
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const ids = [...document.querySelectorAll('[data-testid="timeline"] li')].map((li) => li.textContent);
    return {
      rings: document.querySelectorAll('[aria-label="Calorie e macro"] [role="img"]').length,
      meals: document.querySelectorAll('[aria-label="Pasto del momento"]').length,
      timelines: document.querySelectorAll('[data-testid="timeline"]').length,
      dayContents: document.querySelectorAll('.day-content').length,
      uniqueRows: new Set(ids).size === ids.length,
      titles: document.querySelectorAll('h1').length,
    };
  });
}

/** Swipe orizzontale sul contenuto. Coordinate x fisse: subito dopo uno swipe il contenuto sta ancora tornando
 * a posto (transform) e il suo boundingBox è spostato. */
async function swipe(page: Page, dir: 'left' | 'right') {
  const y = (await page.getByTestId('home-swipe').boundingBox())!.y + 60;
  const [from, to, step] = dir === 'left' ? [340, 100, -20] : [100, 340, 20];
  await page.mouse.move(from, y);
  await page.mouse.down();
  for (let x = from; dir === 'left' ? x >= to : x <= to; x += step) await page.mouse.move(x, y);
  await page.mouse.up();
}

test('primo avvio: benvenuto con i due passi, avviso di installazione, "SOLO BROWSER"', async ({ page }) => {
  await page.goto('./');
  const welcome = page.getByRole('region', { name: 'Benvenuto' });
  await expect(welcome).toBeVisible();
  await expect(welcome.getByRole('link', { name: 'Importa il piano' })).toHaveAttribute('href', '#/dieta');
  await expect(welcome.getByRole('link', { name: 'Crea la scheda' })).toHaveAttribute('href', '#/allena/editor');
  await expect(page.getByRole('note')).toContainText('Aggiungi alla schermata Home');
  await expect(page.getByTestId('sync-status')).toContainText('SOLO BROWSER');
  await expect(page.getByTestId('sync-status')).not.toContainText('✓');
  await expect(title(page)).toHaveText('Lunedì');
});

test('"SYNC OFFLINE ✓" solo da app installata, con service worker e storage persistente; sempre sulla riga della data', async ({
  page,
}) => {
  await emulateInstalled(page);
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const status = page.getByTestId('sync-status');
  await expect(status).toHaveAttribute('data-kind', 'ok');
  await expect(status).toContainText('SYNC OFFLINE ✓');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const row = page.getByTestId('status-row');
    const date = (await row.locator('.date').boundingBox())!;
    const sync = (await status.boundingBox())!;
    expect(Math.abs(date.y - sync.y)).toBeLessThan(2);
    expect((await row.boundingBox())!.height).toBeLessThan(24);
    expect(sync.x + sync.width).toBeLessThanOrEqual(width);
  }
});

test('"NON SALVATO" se il telefono non permette di salvare i dati', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', {
      value: () => {
        throw new DOMException('Storage bloccato', 'SecurityError');
      },
    });
  });
  await page.goto('./');
  await expect(page.getByTestId('sync-status')).toContainText('NON SALVATO');
  await expect(page.getByRole('complementary', { name: 'Dati non disponibili' })).toBeVisible();
});

test('pasto del momento e allenamento; "Segna come fatto" aggiorna anello e timeline e resta dopo il ricaricamento', async ({
  page,
}) => {
  await loadBackup(page);
  await expect(title(page)).toHaveText('Lunedì');
  await expect(page.getByTestId('day-type')).toHaveText('Giorno palestra');
  await expect(ring(page)).toHaveAttribute('aria-label', '0 kcal mangiate su 1.800 di target');
  await expect(page.getByTestId('target-origin')).toHaveText('Target del nutrizionista · giorno palestra');

  await expect(mealCard(page)).toContainText('Adesso · Pranzo · 13:00');
  await expect(mealCard(page).getByRole('heading', { name: 'Pollo, riso e zucchine' })).toBeVisible();
  await expect(mealCard(page)).toContainText('Petto di pollo');

  const workout = page.getByRole('region', { name: 'Allenamento: Petto + Schiena' });
  await expect(workout).toContainText(/Palestra · 18:00–\d{2}:\d{2}/);
  await expect(workout).toContainText('tra 5 h');
  await expect(workout.getByRole('button', { name: 'Avvia allenamento' })).toBeVisible();

  // Testo della voce senza lo stato per lo screen reader (", dopo", ", fatto"…).
  const labels = await page.getByTestId('timeline').locator('.label').allTextContents();
  expect(labels.map((l) => l.replace(/, [^,]+$/, ''))).toEqual([
    'Colazione · Yogurt, avena e banana',
    'Spuntino · Banana',
    'Pranzo · Pollo, riso e zucchine',
    'Post-workout · Whey in acqua',
    'Palestra · Petto + Schiena',
    'Proteine whey · 30 g',
    'Cena · Pasta al tonno',
    'Vitamina D3 · 2.000 UI',
    'Omega-3 · 1 capsula',
  ]);
  await expect(timelineRow(page, 'Pranzo')).toHaveAttribute('data-state', 'now');
  await expect(timelineRow(page, 'Omega-3')).toHaveAttribute('data-state', 'skipped');
  await expect(page.getByRole('complementary', { name: 'Tip del giorno' })).toBeVisible();

  await mealCard(page).getByRole('button', { name: 'Segna Pranzo come fatto' }).click();
  await expect(ring(page)).toHaveAttribute('aria-label', '567 kcal mangiate su 1.800 di target');
  const done = mealCard(page).getByRole('button', { name: 'Pranzo mangiato, tocca per annullare' });
  await expect(done).toHaveText('✓ Mangiato');
  await expect(timelineRow(page, 'Pranzo')).toHaveAttribute('data-state', 'done');

  await page.reload();
  await expect(ring(page)).toHaveAttribute('aria-label', '567 kcal mangiate su 1.800 di target');
  await expect(timelineRow(page, 'Pranzo')).toHaveAttribute('data-state', 'done');

  // Un secondo tocco annulla.
  await mealCard(page).getByRole('button', { name: 'Pranzo mangiato, tocca per annullare' }).click();
  await expect(ring(page)).toHaveAttribute('aria-label', '0 kcal mangiate su 1.800 di target');
});

test('"Ricetta 2" apre la ricetta nella tab Ricette della Dieta', async ({ page }) => {
  await loadBackup(page);
  await mealCard(page).getByRole('link', { name: 'Ricetta 2' }).click();
  await expect(page).toHaveURL(/#\/dieta\?ricetta=2$/);
  await expect(page.getByRole('tab', { name: 'Ricette' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /Pollo, riso e zucchine/ })).toHaveAttribute('aria-expanded', 'true');
});

test('cambio giorno con striscia e swipe più volte: sempre un anello, una card, una timeline, nessun doppione', async ({ page }) => {
  await loadBackup(page);
  const expectClean = async (day: string, step = '') => {
    await expect(title(page), step).toHaveText(day);
    expect(await snapshot(page)).toEqual({ rings: 1, meals: 1, timelines: 1, dayContents: 1, uniqueRows: true, titles: 1 });
  };

  await strip(page).nth(1).click();
  await expectClean('Martedì');
  await expect(page.getByText('Domani · sola lettura')).toBeVisible();
  await expect(mealCard(page)).toContainText('Anteprima');
  await expect(mealCard(page).getByRole('button', { name: /come fatto/ })).toHaveCount(0);
  await expect(ring(page)).toHaveAttribute('aria-label', /kcal nel piano su 1.800 di target/);

  await strip(page).nth(4).click();
  await expectClean('Venerdì');
  await strip(page).nth(0).click();
  await expectClean('Lunedì');

  const swipes = [
    ['left', 'Martedì'],
    ['left', 'Mercoledì'],
    ['right', 'Martedì'],
    ['left', 'Mercoledì'],
    ['right', 'Martedì'],
    ['right', 'Lunedì'],
  ] as const;
  for (const [i, [dir, day]] of swipes.entries()) {
    await swipe(page, dir);
    await expectClean(day, `swipe ${i + 1} verso ${dir}`);
  }
  // Lunedì è il primo giorno della settimana: oltre non si va (resistenza al bordo).
  await swipe(page, 'right');
  await expectClean('Lunedì');

  // Con "Riduci movimento" il cambio è secco, sempre senza doppioni.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await swipe(page, 'left');
  await expectClean('Martedì');
  await page.getByRole('button', { name: 'Torna a oggi' }).click();
  await expectClean('Lunedì');
});

test('mercoledì: piano da riposo con una scheda assegnata, il conflitto si dichiara', async ({ page }) => {
  await loadBackup(page);
  await strip(page).nth(2).click();
  await expect(title(page)).toHaveText('Mercoledì');
  await expect(page.getByTestId('day-type')).toHaveText('Riposo');
  await expect(page.getByTestId('day-conflict')).toHaveText(
    'Il piano alimentare di questo giorno è da giorno di riposo: i target restano quelli del piano.',
  );
  await expect(page.getByRole('region', { name: 'Allenamento: Àddome e mobilità' })).toContainText('in programma');
  // Domenica: riposo senza schede.
  await strip(page).nth(6).click();
  await expect(page.getByRole('region', { name: 'Riposo' })).toContainText('Nessuna scheda in questo giorno');
});

test('"Avvia allenamento" porta alla Readiness; con una sessione in corso la Home mostra "Riprendi allenamento"', async ({
  page,
}) => {
  await loadBackup(page);
  await page.getByRole('button', { name: 'Avvia allenamento' }).click();
  await expect(page).toHaveURL(/#\/sessione\/readiness\?scheda=/);
  await expect(page.getByRole('heading', { name: 'Come stai oggi?' })).toBeVisible();
  for (const label of ['Sonno', 'Umore', 'Energia', 'Stress', 'Affaticamento muscolare']) {
    await page.getByRole('button', { name: `${label}: 4 su 5` }).click();
  }
  await page.getByRole('button', { name: /^Avanti/ }).click();
  await page.getByRole('button', { name: 'Inizia allenamento' }).click();
  await expect(page).toHaveURL(/#\/sessione\/live\?id=/);

  await page.goto('./#/');
  const resume = page.getByRole('region', { name: 'Allenamento in corso' });
  await expect(resume).toContainText('Petto + Schiena');
  await expect(page.getByRole('button', { name: 'Avvia allenamento' })).toHaveCount(0);
  await expect(timelineRow(page, 'Palestra')).toHaveAttribute('data-state', 'now');
  await resume.getByRole('link', { name: 'Riprendi allenamento' }).click();
  await expect(page).toHaveURL(/#\/sessione\/live\?id=/);
});

test('a mezzanotte la Home passa al giorno dopo, senza ricaricare', async ({ page }) => {
  await page.clock.setSystemTime(new Date(2026, 9, 12, 23, 59, 0));
  await loadBackup(page);
  await expect(title(page)).toHaveText('Lunedì');
  await page.clock.runFor(70_000);
  await expect(title(page)).toHaveText('Martedì');
  await expect(strip(page).nth(1)).toHaveAttribute('aria-label', /oggi/);
  await expect(strip(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(mealCard(page).getByRole('button', { name: /come fatto/ })).toBeVisible();
});

test('stati vuoti: senza piano invita a importarlo, senza schede invita a crearla', async ({ page }) => {
  await loadBackup(page, WORKOUTS_ONLY);
  const noPlan = page.getByRole('region', { name: 'Nessun piano alimentare' });
  await expect(noPlan.getByRole('link', { name: 'Importa il piano' })).toHaveAttribute('href', '#/dieta');
  await expect(mealCard(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Allenamento: Petto + Schiena' })).toBeVisible();

  // Solo il piano: svuota i dati e importa la dieta dalla Dieta.
  await page.goto('./#/dev-data');
  await page.getByRole('button', { name: 'Svuota tutto' }).click();
  const clearSheet = page.getByRole('dialog', { name: 'Svuotare tutto?' });
  await clearSheet.getByRole('button', { name: 'Svuota' }).click();
  await expect(clearSheet).toBeHidden();
  await page.goto('./#/dieta');
  await page.getByTestId('diet-input').setInputFiles(EXTENDED);
  const importSheet = page.getByRole('dialog', { name: 'Importa piano' });
  await importSheet.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(importSheet).toBeHidden();
  await page.goto('./#/');
  const noWorkout = page.getByRole('region', { name: 'Nessuna scheda' });
  await expect(noWorkout.getByRole('link', { name: 'Crea la tua scheda' })).toHaveAttribute('href', '#/allena/editor');
  await expect(mealCard(page)).toContainText('Pranzo');
});

test('offline: la Home si apre dal database locale e il pasto si segna', async ({ page }) => {
  await loadBackup(page);
  await goOffline(page);
  await expect(mealCard(page)).toContainText('Pollo, riso e zucchine');
  await expect(page.getByRole('region', { name: 'Allenamento: Petto + Schiena' })).toBeVisible();
  await mealCard(page).getByRole('button', { name: 'Segna Pranzo come fatto' }).click();
  await expect(ring(page)).toHaveAttribute('aria-label', '567 kcal mangiate su 1.800 di target');
  await strip(page).nth(2).click();
  await expect(title(page)).toHaveText('Mercoledì');
});

test('Home: nessuno scroll orizzontale e controlli di almeno 44 px', async ({ page }) => {
  await loadBackup(page);
  const check = async () => {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, a[href]')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { name: el.getAttribute('aria-label') ?? el.textContent?.trim(), w: r.width, h: r.height };
        })
        .filter((b) => b.w < 44 || b.h < 44),
    );
    expect(small).toEqual([]);
  };
  await check();
  await strip(page).nth(2).click();
  await check();
  // iPhone SE: la striscia dei 7 giorni resta a 44 px per giorno.
  await page.setViewportSize({ width: 375, height: 667 });
  await check();
});
