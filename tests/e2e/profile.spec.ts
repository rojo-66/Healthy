import { expect, test, type Page } from '@playwright/test';

// Lunedì 12 ottobre 2026, 10:00. Tutti i dati sono finti.
const NOW = new Date(2026, 9, 12, 10, 0);
const PROFILE_BACKUP = 'tests/fixtures/profile/backup-profile.json';
const MYDIET = 'tests/fixtures/mydiet.json';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  // Niente Web Share: il backup arriva come download, che Playwright può intercettare.
  await page.addInitScript(() => {
    for (const name of ['share', 'canShare']) {
      Object.defineProperty(Navigator.prototype, name, { value: undefined, configurable: true });
    }
  });
});

async function openProfile(page: Page) {
  await page.goto('./#/profilo');
  await expect(page.getByTestId('profile-name')).toBeVisible();
}

/** Backup finto caricato con "Importa backup" del Profilo (anteprima e conferma). */
async function importBackup(page: Page, file: string) {
  await openProfile(page);
  await page.getByTestId('backup-input').setInputFiles(file);
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(sheet).toBeHidden();
}

async function addMeasurement(page: Page, date: string, values: Record<string, string>, notes = '') {
  await page.getByRole('link', { name: '+ Nuova misura' }).click();
  await expect(page.getByRole('heading', { name: 'Nuova misura' })).toBeVisible();
  await page.getByLabel('Data').fill(date);
  for (const [field, value] of Object.entries(values)) await page.locator(`#ms-${field}`).fill(value);
  if (notes) await page.getByLabel('Lettura del nutrizionista').fill(notes);
  await page.getByRole('button', { name: 'Salva misura' }).click();
  await expect(page).toHaveURL(/#\/profilo$/);
}

const tone = (page: Page, testId: string) => page.getByTestId(testId).locator('[data-tone]').first();

/** Card e righe del confronto contate subito (anche durante le animazioni): mai doppioni. */
async function counts(page: Page) {
  return page.evaluate(() => ({
    hero: document.querySelectorAll('[data-testid^="hero-"]').length,
    rows: document.querySelectorAll('[data-testid^="row-"]').length,
    circ: document.querySelectorAll('[data-testid^="circ-"]').length,
    // La barra FFM/FM c'è solo se la misura ha FM e FFM: mai due.
    bars: document.querySelectorAll('[data-testid="split-bar"]').length <= 1,
    dates: document.querySelectorAll('[data-testid="date-after"]').length,
  }));
}

const EXPECTED_COUNTS = { hero: 4, rows: 7, circ: 7, bars: true, dates: 1 };

async function goOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test('compila il profilo, inserisce due misure con la virgola e vede il confronto colorato', async ({ page }) => {
  await openProfile(page);
  await expect(page.getByTestId('empty-measurements')).toBeVisible();
  await expect(page.getByTestId('goal-badge')).toHaveText('Scegli obiettivo');

  // Profilo: anno a 2 cifre → errore, poi corretto.
  await page.getByTestId('profile-facts').click();
  const sheet = page.getByRole('dialog', { name: 'Il tuo profilo' });
  await sheet.getByLabel('Nome').fill('Persona Finta');
  await sheet.getByLabel('Anno di nascita').fill('88');
  await sheet.getByLabel('Altezza (cm)').fill('168,5');
  await sheet.getByRole('button', { name: 'Donna' }).click();
  await sheet.getByRole('button', { name: 'Dimagrimento' }).click();
  await sheet.getByRole('button', { name: 'Salva' }).click();
  await expect(sheet.getByText("Scrivi l'anno a 4 cifre, es. 1990.")).toBeVisible();
  await sheet.getByLabel('Anno di nascita').fill('1988');
  await sheet.getByRole('button', { name: 'Salva' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId('profile-name')).toHaveText('Persona Finta');
  await expect(page.getByTestId('profile-facts')).toContainText('38 anni · 168,5 cm');
  await expect(page.getByTestId('goal-badge')).toHaveText('Dimagrimento');

  // Prima misura: valori senza confronto.
  await addMeasurement(page, '2026-08-14', {
    weightKg: '80,2',
    fmKg: '16,6',
    ffmKg: '63,6',
    bcmKg: '34,5',
    phaDeg: '6,3',
    waistCm: '88,5',
    chestCm: '100',
  });
  await expect(page.getByTestId('single-date')).toHaveText('MISURA DEL 14/08/2026 · NESSUN CONFRONTO');
  await expect(page.getByTestId('hero-weight')).toContainText('80,2');
  await expect(page.getByTestId('hero-weight').locator('[data-tone]')).toHaveAttribute('data-tone', 'none');

  // Seconda misura: punto e virgola valgono uguale; si vede sempre la virgola.
  await addMeasurement(page, '2026-09-25', {
    weightKg: '79.1',
    fmKg: '15,4',
    ffmKg: '63,7',
    bcmKg: '34,8',
    phaDeg: '6,5',
    waistCm: '87',
  });

  await expect(page.getByTestId('date-before')).toHaveText('14/08/2026');
  await expect(page.getByTestId('date-after')).toHaveText('25/09/2026');
  await expect(page.getByTestId('date-span')).toHaveText('6 settimane');

  await expect(page.getByTestId('hero-weight')).toContainText('79,1');
  await expect(page.getByTestId('hero-weight')).toContainText('▼ −1,1 · −1,4 %');
  // Dimagrimento: peso e FM giù = ciano; FFM +0,1 sotto la soglia = grigio; PhA su = ciano.
  await expect(tone(page, 'hero-weight')).toHaveAttribute('data-tone', 'good');
  await expect(tone(page, 'row-fmKg')).toHaveAttribute('data-tone', 'good');
  await expect(tone(page, 'row-ffmKg')).toHaveAttribute('data-tone', 'neutral');
  await expect(tone(page, 'hero-pha')).toHaveAttribute('data-tone', 'good');
  await expect(tone(page, 'circ-waist')).toHaveAttribute('data-tone', 'good');
  // Torace solo nella prima misura: nessuna variazione (mai zero).
  await expect(tone(page, 'circ-chest')).toHaveAttribute('data-tone', 'none');
  await expect(page.getByTestId('circ-chest')).toContainText('—');
  // BCM % sulla massa magra: 34,8 / 63,7 = 54,6 %, calcolata.
  await expect(page.getByTestId('row-bcmKg')).toContainText('54,6 %');
  await expect(page.getByTestId('row-bcmKg')).toContainText('calc.');
  // BMR non inserito: stima dichiarata, variazione grigia.
  await expect(page.getByTestId('hero-bmr')).toContainText('STIMATO');
  await expect(tone(page, 'hero-bmr')).toHaveAttribute('data-tone', 'neutral');
  await expect(page.getByTestId('legend')).toBeVisible();
  expect(await counts(page)).toEqual(EXPECTED_COUNTS);

  // Tutto resta dopo il ricaricamento.
  await page.reload();
  await expect(page.getByTestId('hero-weight')).toContainText('79,1');
});

test('cambiare le date più volte non duplica né sovrappone le card', async ({ page }) => {
  await importBackup(page, PROFILE_BACKUP);
  await expect(page.getByTestId('date-after')).toHaveText('25/09/2026');
  // Ultima misura parziale (solo vita e addome): il peso manca, niente variazione.
  await expect(page.getByTestId('hero-weight')).toContainText('—');
  await expect(tone(page, 'hero-weight')).toHaveAttribute('data-tone', 'none');
  await expect(tone(page, 'circ-waist')).toHaveAttribute('data-tone', 'good');
  await expect(page.getByTestId('next-measurement')).toContainText('PROSSIMA BIOIMPEDENZA · ~6 NOV');
  await expect(page.getByLabel('Il tuo nome come PT')).toHaveValue('Coach Finto');
  await expect(page.getByRole('button', { name: 'Come PT' })).toHaveAttribute('aria-pressed', 'true');

  const choose = async (side: 'before' | 'after', date: string) => {
    await page.getByTestId(`date-${side}`).click();
    const sheet = page.getByRole('dialog', { name: side === 'after' ? 'Misura attuale' : 'Misura precedente' });
    await sheet.getByRole('radio', { name: new RegExp(`^${date}`) }).click();
    await expect(sheet).toBeHidden();
    expect(await counts(page)).toEqual(EXPECTED_COUNTS);
  };

  for (let i = 0; i < 4; i++) {
    await choose('before', '03/07/2026');
    await choose('after', '14/08/2026');
    await expect(page.getByTestId('date-before')).toHaveText('03/07/2026');
    await expect(page.getByTestId('date-span')).toHaveText('6 settimane');
    await expect(page.getByTestId('hero-weight')).toContainText('▼ −1,2');
    // Come precedente la più recente: l'attuale non può andare oltre, la precedente si sposta su quella prima.
    await choose('before', '25/09/2026');
    await expect(page.getByTestId('date-before')).toHaveText('14/08/2026');
    await expect(page.getByTestId('date-after')).toHaveText('25/09/2026');
  }
  expect(await counts(page)).toEqual(EXPECTED_COUNTS);
});

test('modifica ed elimina una misura dallo storico, con conferma', async ({ page }) => {
  await importBackup(page, PROFILE_BACKUP);
  const history = page.getByTestId('history');
  await expect(history.getByRole('listitem')).toHaveCount(3);

  await history.getByRole('link', { name: /14\/08\/2026/ }).click();
  await expect(page.getByRole('heading', { name: 'Modifica misura' })).toBeVisible();
  await expect(page.locator('#ms-weightKg')).toHaveValue('80,2');
  // Data già usata da un'altra misura: errore, nessun salvataggio.
  await page.getByLabel('Data').fill('2026-07-03');
  await page.getByRole('button', { name: 'Salva misura' }).click();
  await expect(page.getByText('Esiste già una misura del 03/07/2026: modificala dallo storico.')).toBeVisible();
  await page.getByLabel('Data').fill('2026-08-14');
  await page.locator('#ms-weightKg').fill('80,0');
  await page.getByRole('button', { name: 'Salva misura' }).click();
  await expect(page).toHaveURL(/#\/profilo$/);
  await expect(history).toContainText('80,0 kg');

  await history.getByRole('link', { name: /14\/08\/2026/ }).click();
  await page.getByRole('button', { name: 'Elimina misura' }).click();
  const confirm = page.getByRole('dialog', { name: 'Eliminare la misura?' });
  await expect(confirm).toContainText('14/08/2026');
  await confirm.getByRole('button', { name: 'Elimina' }).click();
  await expect(page).toHaveURL(/#\/profilo$/);
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(history).not.toContainText('14/08/2026');
});

test('lettura del nutrizionista e condizioni: solo testo, mai HTML', async ({ page }) => {
  await importBackup(page, PROFILE_BACKUP);
  const reading = page.getByTestId('reading');
  await expect(reading).toContainText('Scrivi qui cosa ti ha detto il nutrizionista');

  await reading.getByRole('button', { name: 'Scrivi la lettura' }).click();
  const sheet = page.getByRole('dialog', { name: 'Lettura del nutrizionista' });
  await sheet.getByRole('textbox').fill('Nota <b>finta</b> <img src=x onerror=alert(1)>');
  await sheet.getByRole('button', { name: 'Salva' }).click();
  await expect(sheet).toBeHidden();
  await expect(reading).toContainText('Nota <b>finta</b> <img src=x onerror=alert(1)>');
  await expect(reading.locator('b, img')).toHaveCount(0);

  // È salvata con la misura: un'altra data ha la sua lettura.
  await page.getByTestId('date-after').click();
  await page.getByRole('dialog', { name: 'Misura attuale' }).getByRole('radio', { name: /^14\/08\/2026/ }).click();
  await expect(page.getByTestId('date-before')).toHaveText('03/07/2026');
  await expect(reading).not.toContainText('finta');
  await expect(reading).toContainText('Scrivi qui cosa ti ha detto il nutrizionista');
  await page.getByTestId('history').getByRole('link', { name: /03\/07\/2026/ }).click();
  await expect(page.getByLabel('Lettura del nutrizionista')).toHaveValue('Lettura di prova della prima misura.');
  await page.getByRole('link', { name: 'Annulla' }).click();

  await page.getByTestId('next-measurement').getByRole('button', { name: 'Modifica' }).click();
  const next = page.getByRole('dialog', { name: 'Prossima bioimpedenza' });
  await next.getByRole('button', { name: 'Togli data' }).click();
  await next.getByLabel('Condizioni da rispettare').fill('Stesso orario, a digiuno.');
  await next.getByRole('button', { name: 'Salva' }).click();
  await expect(next).toBeHidden();
  await expect(page.getByTestId('next-measurement')).toContainText('PROSSIMA BIOIMPEDENZA');
  await expect(page.getByTestId('next-measurement')).not.toContainText('~6 NOV');
  await expect(page.getByTestId('next-measurement')).toContainText('Stesso orario, a digiuno.');
});

test('backup dal Profilo: promemoria, esporta, svuota, reimporta, anche offline', async ({ page }) => {
  await importBackup(page, PROFILE_BACKUP);
  await expect(page.getByTestId('backup-stale')).toContainText('Non hai ancora fatto un backup.');
  await expect(page.getByTestId('last-backup')).toHaveText('mai');

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('healthy-backup-2026-10-12.json');
  const file = await download.path();
  await expect(page.getByTestId('backup-status')).toContainText('Backup scaricato');
  await expect(page.getByTestId('backup-stale')).toHaveCount(0);
  await expect(page.getByTestId('last-backup')).not.toHaveText('mai');

  // Svuota dalla pagina tecnica: il Profilo torna vuoto.
  await page.goto('./#/dev-data');
  await page.getByRole('button', { name: 'Svuota tutto' }).click();
  await page.getByRole('dialog', { name: 'Svuotare tutto?' }).getByRole('button', { name: 'Svuota' }).click();
  await openProfile(page);
  await expect(page.getByTestId('empty-measurements')).toBeVisible();

  // Reimporta il file esportato.
  await page.getByTestId('backup-input').setInputFiles(file);
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await expect(sheet).toContainText('6 elementi');
  await sheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId('history').getByRole('listitem')).toHaveCount(3);
  await expect(page.getByTestId('profile-name')).toHaveText('Persona Finta');

  // Offline: tutto dal database locale; anche l'inserimento di una misura.
  await goOffline(page);
  await expect(page.getByTestId('history').getByRole('listitem')).toHaveCount(3);
  await addMeasurement(page, '2026-10-12', { weightKg: '79,5' });
  await expect(page.getByTestId('history').getByRole('listitem')).toHaveCount(4);
  await expect(page.getByTestId('date-before')).toHaveText('25/09/2026');
});

test('un file di backup non valido mostra il motivo e non tocca i dati', async ({ page }) => {
  await importBackup(page, PROFILE_BACKUP);
  await page.getByTestId('backup-input').setInputFiles('tests/fixtures/invalid/wrong-app.json');
  const note = page.getByRole('complementary', { name: 'Backup non valido: nessun dato modificato' });
  await expect(note).toContainText('Questo file non è stato creato da Healthy.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('history').getByRole('listitem')).toHaveCount(3);
});

test('con profilo e peso la stima diventa un\'opzione del completamento guidato della Dieta', async ({ page }) => {
  await importBackup(page, PROFILE_BACKUP);
  await page.goto('./#/importa?da=dieta');
  await page.getByTestId('import-file').setInputFiles(MYDIET);
  await page.getByRole('button', { name: 'Importa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dieta', level: 1 })).toBeVisible();

  await page.goto('./#/dieta/completa');
  await page.getByRole('group', { name: 'Tipo di giornata di lunedì' }).getByRole('button', { name: 'Palestra' }).click();
  const targets = page.locator('[data-day-type="Palestra"]');
  // Donna, 38 anni, 168 cm, ultimo peso 80,2 kg (l'ultima misura non ha il peso): BMR 1.501 × 1,7 (attiva) − 15 %.
  await expect(targets.getByRole('button', { name: 'Usa la stima: 2.170 kcal' })).toBeVisible();
  await expect(targets).toContainText('BMR 1.501 × 1,7 · palestra, attivo');
  // La stima non si applica da sola.
  await expect(targets.getByLabel('Kcal')).toHaveValue('');
  await targets.getByRole('button', { name: 'Usa la stima: 2.170 kcal' }).click();
  await expect(targets.getByLabel('Kcal')).toHaveValue('2170');
});

for (const width of [390, 375]) {
  test(`Profilo a ${width} px: niente scroll orizzontale e controlli di almeno 44 px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await importBackup(page, PROFILE_BACKUP);
    const scroller = page.locator('.screen .body');
    const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, a[href], input, textarea')]
        .filter(
          (el) => el.offsetParent !== null && !el.classList.contains('overlay') && (el as HTMLInputElement).type !== 'file',
        )
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.id, w: r.width, h: r.height };
        })
        .filter((b) => b.w < 44 || b.h < 44),
    );
    expect(small).toEqual([]);

    // Modulo misura.
    await page.getByRole('link', { name: '+ Nuova misura' }).click();
    await expect(page.getByRole('heading', { name: 'Nuova misura' })).toBeVisible();
    const formOverflow = await page.locator('main.body').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(formOverflow).toBeLessThanOrEqual(0);
  });
}

test('con "Riduci movimento" le date cambiano senza card doppie', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await importBackup(page, PROFILE_BACKUP);
  for (let i = 0; i < 6; i++) {
    await page.getByTestId('date-after').click();
    await page
      .getByRole('dialog', { name: 'Misura attuale' })
      .getByRole('radio', { name: i % 2 === 0 ? /^14\/08\/2026/ : /^25\/09\/2026/ })
      .click();
    expect(await counts(page)).toEqual(EXPECTED_COUNTS);
  }
});
