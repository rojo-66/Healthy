import { devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Condivisione tra due telefoni (M8): due contesti separati = due iPhone con memorie diverse.
 * `navigator.share` e gli appunti sono simulati: catturano link e file invece di aprire il foglio di iOS.
 */

interface Phone {
  context: BrowserContext;
  page: Page;
}

async function newPhone(browser: Browser, baseURL: string, opts: { standalone: boolean; reduce?: boolean }): Promise<Phone> {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 844 },
    baseURL,
    reducedMotion: opts.reduce ? 'reduce' : 'no-preference',
  });
  await context.addInitScript((standalone: boolean) => {
    const w = window as unknown as { __shared: unknown[]; __copied: string | null };
    w.__shared = [];
    w.__copied = null;
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const files = data.files ? await Promise.all(data.files.map(async (f) => ({ name: f.name, text: await f.text() }))) : null;
        w.__shared.push({ url: data.url ?? null, title: data.title ?? null, files });
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void (w.__copied = text) },
    });
    if (standalone) {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query.includes('display-mode: standalone') ? ({ ...original(query), matches: true } as MediaQueryList) : original(query);
    }
  }, opts.standalone);
  const page = await context.newPage();
  return { context, page };
}

const copied = (page: Page) => page.evaluate(() => (window as unknown as { __copied: string | null }).__copied);
const sharedFiles = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shared: { files: { name: string; text: string }[] | null }[] }).__shared.flatMap((s) => s.files ?? []));

async function addFromLibrary(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  const lib = page.getByRole('dialog', { name: 'Libreria' });
  await expect(lib.getByRole('status')).toContainText(/\d+ esercizi/);
  await lib.getByLabel('Cerca esercizio').fill(search);
  await lib.getByRole('button', { name: `Aggiungi ${name}`, exact: true }).click();
  await expect(lib).toBeHidden();
}

/** Il PT ("Marco") crea "Gambe PT" e preme "Salva e invia": restituisce link e file. */
async function ptCreatesWorkout(page: Page): Promise<{ link: string; file: { name: string; text: string } }> {
  await page.goto('./#/allena/editor');
  await page.getByRole('button', { name: 'Come PT' }).click();
  await page.getByLabel('Nome del PT').fill('Marco');
  await page.getByLabel('Nome della scheda').fill('Gambe PT');
  await page.getByRole('button', { name: 'Martedì' }).click();
  await page.getByRole('textbox', { name: /^Introduzione/ }).fill('Scheda di prova: <b>non</b> è HTML.');
  await addFromLibrary(page, 'panca piana', 'Panca piana con bilanciere');
  await page.getByRole('button', { name: 'Salva e invia' }).click();
  return shareFromSheet(page, '«Gambe PT» salvata · v1.');
}

/** Dal pannello Condividi aperto: copia il link e condivide il file. */
async function shareFromSheet(page: Page, intro: string | RegExp) {
  const sheet = page.getByRole('dialog', { name: 'Condividi «Gambe PT»' });
  await expect(sheet).toContainText(intro);
  await expect(sheet.getByTestId('share-facts')).toContainText(/link \d/);
  await sheet.getByRole('button', { name: 'Copia link' }).click();
  await expect(sheet.getByRole('status')).toHaveText('Link copiato: incollalo in un messaggio.');
  const link = await copied(page);
  expect(link).toMatch(/^http:\/\/localhost:\d+\/Healthy\/#import=[A-Za-z0-9+\-$]+$/);
  const before = (await sharedFiles(page)).length;
  await sheet.getByRole('button', { name: 'Condividi file' }).click();
  await expect(sheet.getByRole('status')).toHaveText('File condiviso.');
  const files = await sharedFiles(page);
  expect(files).toHaveLength(before + 1);
  await sheet.getByRole('button', { name: 'Chiudi' }).last().click();
  await expect(sheet).toBeHidden();
  return { link: link!, file: files[files.length - 1]! };
}

/** Il PT modifica la sua scheda (intro) e la rimanda: v1 → v2. */
async function ptSendsV2(page: Page) {
  await page.getByRole('button', { name: 'Torna alle schede' }).click();
  await page.getByRole('button', { name: /^Gambe PT:/ }).click();
  await page.getByRole('dialog', { name: 'Gambe PT' }).getByRole('button', { name: /^Modifica/ }).click();
  await expect(page.getByTestId('version-badge')).toHaveText('v1 → v2');
  await page.getByRole('textbox', { name: /^Introduzione/ }).fill('Versione 2: più carico.');
  await page.getByRole('button', { name: 'Salva e invia' }).click();
  return shareFromSheet(page, '«Gambe PT» salvata · v1 → v2.');
}

async function pasteLink(page: Page, link: string) {
  await page.goto('./#/importa?da=allena');
  await page.getByLabel('Incolla link o codice').fill(`Ecco la scheda nuova:\n${link}`);
  await page.getByRole('button', { name: 'Leggi' }).click();
  await expect(page.getByTestId('import-preview')).toBeVisible();
}

const rows = (page: Page) => page.getByTestId('workout-row');

test('il PT manda una scheda: in Safari solo anteprima, nell’app import; poi la v2 sostituisce la v1', async ({ browser, baseURL }) => {
  const pt = await newPhone(browser, baseURL!, { standalone: true });
  const { link } = await ptCreatesWorkout(pt.page);

  // Telefono del cliente, link toccato in Messaggi → Safari: anteprima ma nessun salvataggio.
  const safari = await newPhone(browser, baseURL!, { standalone: false });
  await safari.page.goto(link);
  await expect(safari.page).toHaveURL(/#\/importa\?da=link$/);
  await expect(safari.page.getByTestId('safari-notice')).toContainText('Sei in Safari');
  await expect(safari.page.getByTestId('import-preview')).toContainText('Marco · v1');
  await expect(safari.page.getByRole('heading', { name: 'Gambe PT' })).toBeVisible();
  // Il testo ricevuto è testo, mai HTML.
  await expect(safari.page.getByText('Scheda di prova: <b>non</b> è HTML.')).toBeVisible();
  await expect(safari.page.getByRole('button', { name: 'Importa', exact: true })).toHaveCount(0);
  await safari.page.getByRole('button', { name: 'Copia link' }).click();
  expect(await copied(safari.page)).toBe(link);
  await safari.page.goto('./#/allena');
  await expect(safari.page.getByRole('heading', { name: 'Nessuna scheda' })).toBeVisible();
  await safari.context.close();

  // Stesso link nell'app installata: anteprima e import.
  const client = await newPhone(browser, baseURL!, { standalone: true });
  await client.page.goto(link);
  await expect(client.page.getByTestId('safari-notice')).toHaveCount(0);
  await expect(client.page.getByTestId('version-notice')).toHaveCount(0);
  await client.page.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(client.page.getByRole('heading', { name: 'Allena', level: 1 })).toBeVisible();
  await expect(client.page.getByRole('status').first()).toContainText('Scheda «Gambe PT» importata (MARCO · v1).');
  await expect(rows(client.page)).toHaveCount(1);
  await expect(rows(client.page)).toContainText('MARCO · v1');
  // La ricarica non reimporta: l'hash è stato ripulito.
  await client.page.reload();
  await expect(rows(client.page)).toHaveCount(1);
  expect(client.page.url()).not.toContain('import=');

  // App già aperta e nuovo link nell'indirizzo (hashchange): stesso link → "già presente".
  await client.page.evaluate((hash) => (location.hash = hash), link.slice(link.indexOf('#')));
  await expect(client.page.getByTestId('version-notice')).toHaveAttribute('data-status', 'same');
  await expect(client.page.getByRole('button', { name: 'Sostituisci' })).toHaveCount(0);

  // Il PT modifica e rimanda: il cliente incolla il link della v2 e sostituisce.
  const v2 = await ptSendsV2(pt.page);
  await pasteLink(client.page, v2.link);
  await expect(client.page.getByTestId('version-notice')).toHaveAttribute('data-status', 'newer');
  await expect(client.page.getByTestId('version-notice')).toContainText('Hai già «Gambe PT» (v1): questa è la v2');
  await client.page.getByRole('button', { name: 'Sostituisci' }).click();
  await expect(rows(client.page)).toHaveCount(1);
  await expect(rows(client.page)).toContainText('MARCO · v2');
  await client.page.getByRole('button', { name: /^Gambe PT:/ }).click();
  await client.page.getByRole('dialog', { name: 'Gambe PT' }).getByRole('button', { name: /^Vedi/ }).click();
  await expect(client.page.getByText('Versione 2: più carico.')).toBeVisible();

  // Cronologia: la v1 sostituita si può ripristinare (e la v2 resta nella cronologia).
  await client.page.goto('./#/allena');
  await client.page.getByRole('button', { name: /^Gambe PT:/ }).click();
  await client.page.getByRole('dialog', { name: 'Gambe PT' }).getByRole('button', { name: /^Ripristina versione precedente/ }).click();
  const confirm = client.page.getByRole('dialog', { name: 'Ripristinare una versione precedente?' });
  await confirm.getByRole('button', { name: /^Torna alla v1/ }).click();
  await expect(rows(client.page)).toContainText('MARCO · v1');
  await expect(client.page.getByRole('status').first()).toContainText('«Gambe PT» è tornata alla v1.');
  await client.page.getByRole('button', { name: /^Gambe PT:/ }).click();
  await expect(client.page.getByRole('dialog', { name: 'Gambe PT' })).toContainText('1 versione conservata');

  await pt.context.close();
  await client.context.close();
});

test('versione nuova salvata come copia; import da file (anche doppione e backup rifiutato); tutto offline', async ({ browser, baseURL }) => {
  const pt = await newPhone(browser, baseURL!, { standalone: true });
  const v1 = await ptCreatesWorkout(pt.page);
  expect(v1.file.name).toBe('healthy-scheda-gambe-pt-v1.json');
  const v2 = await ptSendsV2(pt.page);
  await pt.context.close();

  const client = await newPhone(browser, baseURL!, { standalone: true });
  await client.page.goto('./#/allena');
  await expect(client.page.getByRole('heading', { name: 'Nessuna scheda' })).toBeVisible();
  // Offline dopo il primo caricamento: l'import non usa la rete.
  await client.page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await client.context.setOffline(true);
  await client.page.reload();
  expect(await client.page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // File della v1 dalla schermata Importa.
  await client.page.getByRole('link', { name: 'Importa una scheda da link, QR o file' }).click();
  const v1File = { name: v1.file.name, mimeType: 'application/json', buffer: Buffer.from(v1.file.text) };
  await client.page.getByTestId('import-file').setInputFiles(v1File);
  await expect(client.page.getByTestId('import-preview')).toContainText('Marco · v1');
  await client.page.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(rows(client.page)).toContainText('MARCO · v1');

  // Lo stesso file di nuovo: già presente, solo copia.
  await client.page.goto('./#/importa?da=allena');
  await client.page.getByTestId('import-file').setInputFiles(v1File);
  await expect(client.page.getByTestId('version-notice')).toContainText('nella stessa versione (v1)');
  await expect(client.page.getByRole('button', { name: 'Importa', exact: true })).toHaveCount(0);
  await client.page.getByRole('button', { name: 'Annulla' }).click();

  // Un backup non si importa da qui.
  await client.page.getByTestId('import-file').setInputFiles('tests/fixtures/backup-valid.json');
  await expect(client.page.getByTestId('import-errors')).toContainText('si ripristina da Profilo › Backup e dati');

  // La v2 arriva con il link: "Salva come copia" tiene anche la v1.
  await pasteLink(client.page, v2.link);
  await expect(client.page.getByRole('button', { name: 'Sostituisci' })).toBeVisible();
  await client.page.getByRole('button', { name: 'Salva come copia' }).click();
  await expect(rows(client.page)).toHaveCount(2);
  await expect(client.page.getByRole('button', { name: /^Gambe PT \(copia\): MARCO · v2/ })).toBeVisible();
  await expect(client.page.getByRole('button', { name: /^Gambe PT: MARCO · v1/ })).toBeVisible();

  // Link tagliato da un messaggio: errore chiaro, niente salvato.
  await client.page.goto('./#/importa?da=allena');
  await client.page.getByLabel('Incolla link o codice').fill(v2.link.slice(0, v2.link.length - 60));
  await client.page.getByRole('button', { name: 'Leggi' }).click();
  await expect(client.page.getByTestId('import-errors')).toContainText('Il link è incompleto');
  await client.context.close();
});

test('dieta: avviso sui dati personali, solo file (troppo lunga per link e QR), import sull’altro telefono', async ({ browser, baseURL }) => {
  const a = await newPhone(browser, baseURL!, { standalone: true });
  await a.page.goto('./#/importa?da=dieta');
  await a.page.getByTestId('import-file').setInputFiles('tests/fixtures/diet-extended.json');
  await a.page.getByRole('button', { name: 'Importa', exact: true }).click();
  await a.page.getByRole('button', { name: /^Piano .*: importa, esporta/ }).click();
  await a.page.getByRole('dialog', { name: 'Piano di esempio' }).getByRole('button', { name: /^Condividi/ }).click();
  const sheet = a.page.getByRole('dialog', { name: 'Condividi «Piano di esempio»' });
  await expect(sheet).toContainText('target personali');
  await expect(sheet.getByRole('button', { name: 'Condividi file' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Continua' }).click();
  await expect(sheet.getByTestId('share-link-reason')).toContainText('Troppo lungo per un link');
  await expect(sheet.getByTestId('share-qr-reason')).toHaveText('Troppo lungo anche per il QR: usa il file.');
  await expect(sheet.getByRole('button', { name: 'Copia link' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Condividi file' }).click();
  await expect(sheet.getByRole('status')).toHaveText('File condiviso.');
  const [file] = await sharedFiles(a.page);
  expect(file!.name).toBe('healthy-dieta-piano-di-esempio.json');
  await a.context.close();

  const b = await newPhone(browser, baseURL!, { standalone: true });
  await b.page.goto('./#/dieta');
  await b.page.getByRole('link', { name: 'Importa il tuo piano' }).click();
  await b.page.getByTestId('import-file').setInputFiles({ name: file!.name, mimeType: 'application/json', buffer: Buffer.from(file!.text) });
  await expect(b.page.getByTestId('import-preview')).toContainText('Giorni7');
  await b.page.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(b.page.getByRole('button', { name: /^Piano Piano di esempio/ })).toBeVisible();
  await b.context.close();
});

test('QR: il PT lo mostra, il cliente lo legge con la fotocamera dell’app (poi spenta); permesso negato', async ({ browser, baseURL }) => {
  const pt = await newPhone(browser, baseURL!, { standalone: true });
  await ptCreatesWorkout(pt.page);
  await pt.page.goto('./#/allena');
  await pt.page.getByRole('button', { name: 'Condividi Gambe PT' }).click();
  const sheet = pt.page.getByRole('dialog', { name: 'Condividi «Gambe PT»' });
  await sheet.getByRole('button', { name: 'Mostra il QR' }).click();
  const qr = sheet.getByRole('img', { name: 'QR del link di «Gambe PT»' });
  await expect(qr.locator('path')).toHaveAttribute('d', /^M/);
  await expect(sheet).toContainText('Alza la luminosità');
  const box = await qr.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(300);
  const png = (await qr.screenshot()).toString('base64');
  await pt.context.close();

  // Fotocamera simulata: un canvas che mostra il QR fotografato dal telefono del PT.
  const client = await newPhone(browser, baseURL!, { standalone: true });
  await client.page.goto('./#/importa?da=allena');
  await client.page.evaluate((data) => {
    const w = window as unknown as { __tracks: MediaStreamTrack[] };
    navigator.mediaDevices.getUserMedia = async () => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 720;
      const ctx = canvas.getContext('2d')!;
      const draw = () => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 720, 720);
        ctx.drawImage(img, 60, 60, 600, 600);
      };
      draw();
      setInterval(draw, 100);
      const stream = canvas.captureStream(10);
      w.__tracks = stream.getTracks();
      return stream;
    };
  }, png);
  await client.page.getByRole('button', { name: 'Scansiona QR' }).click();
  await expect(client.page.getByTestId('import-preview')).toContainText('Marco · v1', { timeout: 15_000 });
  await expect(client.page.getByRole('dialog', { name: 'Scansiona QR' })).toBeHidden();
  expect(
    await client.page.evaluate(() =>
      (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.every((t) => t.readyState === 'ended'),
    ),
  ).toBe(true);
  await client.page.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(rows(client.page)).toContainText('MARCO · v1');

  // Permesso negato: messaggio chiaro e alternativa.
  await client.page.goto('./#/importa?da=allena');
  await client.page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('negato', 'NotAllowedError');
    };
  });
  await client.page.getByRole('button', { name: 'Scansiona QR' }).click();
  const scanner = client.page.getByRole('dialog', { name: 'Scansiona QR' });
  await expect(scanner).toContainText('Hai negato l’accesso alla fotocamera');
  await scanner.getByRole('button', { name: 'Incolla o scegli il file' }).click();
  await expect(scanner).toBeHidden();
  await expect(client.page.getByLabel('Incolla link o codice')).toBeVisible();
  await client.context.close();
});

test('schermata Importa e pannello Condividi: 44 px, niente scroll orizzontale, "Riduci movimento"', async ({ browser, baseURL }) => {
  const phone = await newPhone(browser, baseURL!, { standalone: true, reduce: true });
  const { page } = phone;
  await ptCreatesWorkout(page);
  await page.goto('./#/importa?da=allena');
  const check = async () => {
    const result = await page.evaluate(() => {
      const small = [...document.querySelectorAll('button, a, textarea')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44) && !el.closest('[aria-hidden="true"]');
        })
        .map((el) => el.textContent?.trim() || el.getAttribute('aria-label'));
      return { small, overflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(result.overflow).toBe(false);
    expect(result.small).toEqual([]);
  };
  await check();
  await page.getByRole('button', { name: 'Indietro' }).click();
  await page.getByRole('button', { name: 'Condividi Gambe PT' }).click();
  await expect(page.getByRole('dialog', { name: 'Condividi «Gambe PT»' })).toBeVisible();
  await check();
  await phone.context.close();
});
