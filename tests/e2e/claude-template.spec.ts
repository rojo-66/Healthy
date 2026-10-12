import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Lunedì 12 ottobre 2026, 13:00.
const NOW = new Date(2026, 9, 12, 13, 0);
const FILLED = 'tests/fixtures/diet-claude-filled.json';
const TEMPLATE = 'src/lib/diet/template/healthy-dieta-modello.json';
const PROMPT =
  'Ti allego la mia dieta e il modello healthy-dieta-modello.json. Compila il modello seguendo le istruzioni che contiene e restituiscimi il file JSON completo da scaricare. Poi elencami cosa mancava nella dieta.';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    // Niente Web Share: il modello arriva come download, che Playwright può intercettare.
    for (const name of ['share', 'canShare']) {
      Object.defineProperty(Navigator.prototype, name, { value: undefined, configurable: true });
    }
    const w = window as unknown as { __copied: string | null };
    w.__copied = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void (w.__copied = text) },
    });
  });
});

const copied = (page: Page) => page.evaluate(() => (window as unknown as { __copied: string | null }).__copied);
const planButton = (page: Page) => page.getByRole('button', { name: /^Piano .*: importa, esporta/ });
const guide = (page: Page) => page.getByRole('dialog', { name: 'Prepara il piano con Claude' });

/** Dalla Dieta vuota: guida → scarica il modello → copia il messaggio → importa il file "compilato da Claude". */
async function guideToImport(page: Page) {
  await expect(page.getByRole('heading', { name: 'Nessun piano' })).toBeVisible();
  await page.getByRole('button', { name: 'Fallo preparare a Claude' }).click();
  const sheet = guide(page);
  await expect(sheet).toContainText("La dieta la invii tu a Claude: l'app non manda niente da sola.");

  // 1. Modello: copia del modello con _modello e la data di oggi, nessun dato.
  const downloading = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Scarica il modello' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('healthy-dieta-modello.json');
  const model = JSON.parse(readFileSync(await download.path(), 'utf8')) as Record<string, unknown>;
  expect(model).toMatchObject({ app: 'healthy-app', kind: 'diet', _modello: true, _generato: '2026-10-12', products: {} });
  await expect(sheet.getByRole('status')).toHaveText('File scaricato: healthy-dieta-modello.json');

  // 2. Messaggio per Claude negli appunti.
  await expect(sheet.getByTestId('claude-prompt')).toHaveText(PROMPT);
  await sheet.getByRole('button', { name: 'Copia', exact: true }).click();
  await expect(sheet.getByRole('status')).toHaveText('Messaggio copiato: incollalo nella chat con Claude.');
  expect(await copied(page)).toBe(PROMPT);

  // 3. Import del file restituito.
  await sheet.getByRole('button', { name: 'Importa il file' }).click();
  await expect(page).toHaveURL(/#\/importa\?da=dieta$/);
  await page.getByTestId('import-file').setInputFiles(FILLED);
  const preview = page.getByRole('article', { name: 'Anteprima del piano' });
  await expect(preview).toContainText('Piano di prova Claude');
  await expect(page.getByTestId('import-preview')).toContainText('Giorni7');
  await expect(preview).toContainText('Martedì: manca il tipo di giornata');
  await expect(preview).toContainText('Mancano i target di un tipo di giornata');
  await expect(preview).toContainText('3 alimenti senza valori nutrizionali');
  await page.getByRole('button', { name: 'Importa', exact: true }).click();

  // Piano attivo, da completare; i dati mancanti finiscono nel completamento guidato.
  await expect(planButton(page)).toContainText('Piano di prova Claude');
  await expect(page.getByRole('complementary', { name: 'Indicazioni generali del nutrizionista' })).toContainText(
    "bevi almeno 2 litri d'acqua",
  );
  await expect(page.getByRole('complementary', { name: 'Nota del nutrizionista' })).toContainText('In alternativa al pollo');
  const todo = page.getByRole('complementary', { name: 'Piano da completare' });
  await todo.getByRole('link', { name: 'Completa il piano' }).click();

  await expect(page).toHaveURL(/#\/dieta\/completa$/);
  await expect(page.getByText('Martedì: manca il tipo di giornata')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alimenti senza valori (3)' })).toBeVisible();
  const pct = page.getByTestId('completeness');
  const before = await pct.textContent();
  await page.getByRole('group', { name: 'Tipo di giornata di martedì' }).getByRole('button', { name: 'Palestra' }).click();
  await expect(pct).not.toHaveText(before ?? '');
  await expect(page.getByText('Martedì: manca il tipo di giornata')).toHaveCount(0);
}

test('dalla Dieta vuota: guida, modello, messaggio copiato, import del file compilato e completamento guidato', async ({ page }) => {
  await page.goto('./#/dieta');
  await guideToImport(page);
});

test('tutto il flusso funziona offline', async ({ page, context }) => {
  await page.goto('./#/dieta');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await guideToImport(page);
});

test('il modello vuoto non si importa e porta alla guida; il testo copiato dalla chat si legge', async ({ page }) => {
  await page.goto('./#/importa?da=dieta');
  await page.getByTestId('import-file').setInputFiles(TEMPLATE);
  const note = page.getByRole('complementary', { name: 'Non importato' });
  await expect(note).toContainText('Questo è il modello vuoto: compilalo prima con Claude');
  await expect(page.getByTestId('import-preview')).toHaveCount(0);
  await note.getByRole('button', { name: 'Apri la guida' }).click();
  const sheet = guide(page);
  await expect(sheet).toBeVisible();
  // Da Importa, "Importa il file" chiude soltanto il foglio.
  await sheet.getByRole('button', { name: 'Importa il file' }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#\/importa\?da=dieta$/);

  // Risposta della chat incollata così com'è: si toglie solo il contorno del JSON.
  const json = readFileSync(FILLED, 'utf8');
  await page.getByLabel('Incolla link o codice').fill(`Ecco il piano compilato:\n\`\`\`json\n${json}\`\`\`\nMancavano alcuni valori.`);
  await page.getByRole('button', { name: 'Leggi' }).click();
  await expect(page.getByRole('article', { name: 'Anteprima del piano' })).toContainText('Piano di prova Claude');

  // Un JSON con la virgola decimale: messaggio con la riga, nessuna anteprima.
  await page.getByRole('button', { name: "← Importa un'altra cosa" }).click();
  await page.getByLabel('Incolla link o codice').fill('{\n  "app": "healthy-app",\n  "q": 1,5\n}');
  await page.getByRole('button', { name: 'Leggi' }).click();
  await expect(page.getByRole('complementary', { name: 'Non importato' })).toContainText(
    'Riga 3: il numero «1,5» è scritto con la virgola: usa il punto (1.5)',
  );
});

test('"Modello per Claude" dal pannello del piano; foglio senza scroll orizzontale e con controlli ≥ 44 px', async ({ page }) => {
  await page.goto('./#/importa?da=dieta');
  await page.getByTestId('import-file').setInputFiles(FILLED);
  await page.getByRole('button', { name: 'Importa', exact: true }).click();
  await planButton(page).click();
  const panel = page.getByRole('dialog', { name: 'Piano di prova Claude' });
  await panel.getByRole('button', { name: /Modello per Claude/ }).click();
  const sheet = guide(page);
  await expect(sheet).toBeVisible();
  await expect(panel).toBeHidden();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  const sizes = await sheet.locator('button').evaluateAll((els) =>
    els.map((el) => ({ name: el.getAttribute('aria-label') ?? el.textContent?.trim(), ...el.getBoundingClientRect().toJSON() })),
  );
  expect(sizes.length).toBeGreaterThanOrEqual(4);
  for (const s of sizes) {
    expect(s.height, s.name).toBeGreaterThanOrEqual(44);
    expect(s.width, s.name).toBeGreaterThanOrEqual(44);
  }
});
