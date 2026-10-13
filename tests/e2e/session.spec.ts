import { expect, test, type Locator, type Page } from '@playwright/test';

// Lunedì 12 ottobre 2026, 18:00. Orologio simulato: il recupero si fa avanzare con fastForward.
const NOW = new Date(2026, 9, 12, 18, 0);

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

const rows = (page: Page) => page.getByTestId('set-row');
const restButton = (page: Page) => page.getByTestId('rest-button');
const restSheet = (page: Page) => page.getByRole('dialog', { name: 'Recupero' });
const exerciseName = (page: Page) => page.getByRole('region', { name: 'Esercizio in corso' }).getByRole('heading', { level: 2 });
const check = (row: Locator, n: number) => row.getByRole('button', { name: new RegExp(`serie ${n}( |$)`, 'i') });

async function addFromLibrary(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  const lib = page.getByRole('dialog', { name: 'Libreria' });
  await expect(lib.getByRole('status')).toContainText(/\d+ esercizi/);
  await lib.getByLabel('Cerca esercizio').fill(search);
  await lib.getByRole('button', { name: `Aggiungi ${name}`, exact: true }).click();
  await expect(lib).toBeHidden();
}

/**
 * Scheda di lunedì con intro, un riscaldamento, panca piana + lat machine (3 × 10, 0 kg, 90 s).
 * Il cardio come esercizio (2a) è provato in `cardio-run.spec.ts`.
 */
async function createWorkout(page: Page, name = 'Spinta finta') {
  await page.goto('./#/allena/editor');
  await page.getByLabel('Nome della scheda').fill(name);
  await page.getByRole('button', { name: 'Lunedì' }).click();
  await page.getByRole('textbox', { name: /^Introduzione/ }).fill('Oggi si spinge.\nPrima serie leggera.');
  await page.getByRole('button', { name: /Riscaldamento e mobilità/ }).click();
  const warm = page.getByRole('dialog', { name: 'Riscaldamento e mobilità' });
  await warm.getByRole('button', { name: '+ Aggiungi voce' }).click();
  await warm.getByLabel('Nome della voce 1').fill('Rotazioni spalle');
  await warm.getByLabel('Dose della voce 1').fill('2 × 15');
  await warm.getByRole('button', { name: 'Chiudi' }).first().click();
  await expect(warm).toBeHidden();
  await addFromLibrary(page, 'panca piana', 'Panca piana con bilanciere');
  await addFromLibrary(page, 'lat machine', 'Lat machine presa larga');
  await page.getByRole('button', { name: 'Salva e invia' }).click();
  // "Salva e invia" (M8) apre il pannello Condividi: si chiude e si torna alle schede.
  const share = page.getByRole('dialog', { name: /^Condividi «/ });
  await share.getByRole('button', { name: 'Chiudi' }).last().click();
  await expect(share).toBeHidden();
  await page.getByRole('button', { name: 'Torna alle schede' }).click();
  await expect(page.getByRole('heading', { name: 'Allena', level: 1 })).toBeVisible();
}

async function goOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

async function answerReadiness(page: Page, values = [4, 4, 3, 4, 5]) {
  const labels = ['Sonno', 'Umore', 'Energia', 'Stress', 'Affaticamento muscolare'];
  for (const [i, label] of labels.entries()) {
    await page.getByRole('button', { name: `${label}: ${values[i]} su 5` }).click();
  }
}

/** Da Allena fino al primo esercizio. */
async function startFromAllena(page: Page) {
  await page.getByRole('region', { name: 'Prossimo allenamento' }).getByRole('button', { name: 'Avvia' }).click();
  await expect(page.getByRole('heading', { name: 'Come stai oggi?' })).toBeVisible();
  await answerReadiness(page);
  await page.getByRole('button', { name: /^Avanti/ }).click();
  await page.getByRole('button', { name: 'Inizia allenamento' }).click();
  await expect(exerciseName(page)).toHaveText('Panca piana con bilanciere');
}

test('sessione completa offline: readiness, intro, serie, recupero, PREC/SUCC, ricarica, termina', async ({ page }) => {
  // Foglio di condivisione simulato: registra cosa riceverebbe iOS.
  await page.addInitScript(() => {
    const nav = navigator as Navigator & { canShare: (d: ShareData) => boolean; share: (d: ShareData) => Promise<void> };
    nav.canShare = () => true;
    nav.share = async (data: ShareData) => {
      const files = data.files ?? [];
      const kind = files[0] ? (JSON.parse(await files[0].text()) as { kind: string }).kind : null;
      (window as unknown as { __shared: unknown }).__shared = { text: data.text, files: files.map((f) => f.name), kind };
    };
  });
  await createWorkout(page);
  await goOffline(page);

  // --- Readiness ---
  await page.getByRole('region', { name: 'Prossimo allenamento' }).getByRole('button', { name: 'Avvia' }).click();
  await expect(page.getByRole('heading', { name: 'Come stai oggi?' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Passo 1 di 3' })).toBeVisible();
  const notYet = page.getByRole('button', { name: 'Rispondi a tutte (0/5)' });
  await expect(notYet).toBeDisabled();
  await answerReadiness(page, [4, 4, 3, 4, 2]);
  await page.getByRole('button', { name: 'Affaticamento muscolare: 5 su 5' }).click(); // si può cambiare idea
  await expect(page.getByRole('button', { name: 'Affaticamento muscolare: 5 su 5' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('readiness-total')).toHaveText('20/25');

  // --- Intro PT ---
  await page.getByRole('button', { name: /^Avanti/ }).click();
  await expect(page.getByRole('list', { name: 'Passo 2 di 3' })).toBeVisible();
  await expect(page.getByTestId('intro-chips')).toContainText('2 esercizi');
  await expect(page.getByTestId('intro-chips')).toContainText('6 serie');
  await expect(page.getByTestId('intro-chips')).not.toContainText('cardio');
  await expect(page.getByRole('complementary', { name: 'Dal tuo PT' })).toContainText('Oggi si spinge.');
  const warm = page.getByRole('button', { name: /Rotazioni spalle/ });
  await warm.click();
  await expect(warm).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Inizia allenamento' }).click();

  // --- Live: primo esercizio ---
  await expect(exerciseName(page)).toHaveText('Panca piana con bilanciere');
  await expect(page.getByRole('timer', { name: /Tempo trascorso/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Esercizio 1 di 2' })).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByText('Termina allenamento')).toHaveCount(0);

  await page.getByLabel('Chili serie 1').fill('57,5');
  await page.getByLabel('Ripetizioni serie 1').fill('8');
  await check(rows(page).nth(0), 1).click();
  await expect(check(rows(page).nth(0), 1)).toHaveAttribute('aria-pressed', 'true');
  // La spunta avvia il recupero con il tempo dell'esercizio (90 s).
  await expect(restButton(page)).toHaveAttribute('aria-label', /Recupero (90|89) secondi/);
  await page.clock.fastForward(30_000);
  await expect(restButton(page)).toHaveAttribute('aria-label', /Recupero (60|59) secondi/);
  // Togliere la spunta non riavvia il recupero.
  await check(rows(page).nth(0), 1).click();
  await expect(restButton(page)).toHaveAttribute('aria-label', /Recupero (60|59) secondi/);
  await check(rows(page).nth(0), 1).click();

  // --- Pannello del recupero ---
  await restButton(page).click();
  const sheet = restSheet(page);
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Recupero di 120 secondi' }).click();
  await expect(sheet.getByRole('timer')).toHaveText(/02:00|01:59/);
  await sheet.getByRole('button', { name: 'Togli 15 secondi' }).click();
  await expect(sheet.getByRole('timer')).toHaveText(/01:45|01:44/);
  await sheet.getByRole('button', { name: 'Pausa' }).click();
  const paused = await sheet.getByRole('timer').textContent();
  await page.clock.fastForward(20_000);
  await expect(sheet.getByRole('timer')).toHaveText(paused ?? '');
  await sheet.getByRole('button', { name: 'Riprendi' }).click();
  await sheet.getByRole('button', { name: 'Predefinito del PT: 90 s' }).click();
  await expect(sheet.getByRole('timer')).toHaveText(/01:30|01:29/);
  await sheet.getByRole('button', { name: 'Salta' }).click();
  await expect(sheet).toBeHidden();
  await expect(restButton(page)).toHaveAttribute('aria-label', /pronto/);

  // --- Doppia spunta: tutte le serie, poi fine recupero ---
  await page.getByRole('button', { name: 'Spunta tutte le serie' }).click();
  for (let n = 1; n <= 3; n++) await expect(check(rows(page).nth(n - 1), n)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Togli tutte le spunte' })).toBeVisible();
  await page.clock.fastForward(91_000);
  await expect(page.getByTestId('rest-announce')).toHaveText('Recupero finito');
  await expect(restButton(page)).toHaveAttribute('aria-label', /pronto/);

  // --- SUCC / PREC ---
  await page.getByRole('button', { name: 'Esercizio successivo' }).click();
  await expect(exerciseName(page)).toHaveText('Lat machine presa larga');
  await expect(page.getByRole('button', { name: 'Esercizio successivo' })).toBeDisabled();
  await page.getByRole('button', { name: 'Esercizio precedente' }).click();
  await expect(exerciseName(page)).toHaveText('Panca piana con bilanciere');
  await expect(page.getByLabel('Chili serie 1')).toHaveValue('57,5');
  await page.getByRole('button', { name: 'Esercizio successivo' }).click();

  // --- Secondo esercizio: serie aggiunta e nota per il PT ---
  await page.getByRole('button', { name: '+ Aggiungi serie' }).click();
  await expect(rows(page)).toHaveCount(4);
  await check(rows(page).nth(0), 1).click();
  await page.getByLabel('Le tue note per il PT').fill('Spalla sinistra un po’ rigida.');
  await expect(page.getByRole('button', { name: 'Termina allenamento' })).toBeVisible();

  // --- Ricarica a metà sessione: stesso esercizio, serie e nota ---
  await page.waitForTimeout(400); // il testo si salva dopo una breve pausa
  await page.reload();
  await expect(exerciseName(page)).toHaveText('Lat machine presa larga');
  await expect(rows(page)).toHaveCount(4);
  await expect(check(rows(page).nth(0), 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Le tue note per il PT')).toHaveValue('Spalla sinistra un po’ rigida.');

  // --- Uscita con conferma, poi "Riprendi allenamento" da Allena ---
  await page.getByRole('button', { name: 'Torna alla scheda' }).click();
  await page.getByRole('dialog', { name: 'Uscire dall’allenamento?' }).getByRole('button', { name: 'Esci, la riprendo dopo' }).click();
  const resume = page.getByRole('region', { name: 'Allenamento in corso' });
  await expect(resume).toContainText('Spinta finta');
  await expect(resume).toContainText('4/6 serie · esercizio 2 di 2');
  await resume.getByRole('link', { name: 'Riprendi allenamento' }).click();
  await expect(exerciseName(page)).toHaveText('Lat machine presa larga');

  // --- Termina: avviso serie mancanti, RPE (il cardio si segna nel suo esercizio, 2a) ---
  await page.getByRole('button', { name: 'Termina allenamento' }).click();
  const finish = page.getByRole('dialog', { name: 'Termina allenamento' });
  await expect(finish).toContainText('Mancano 2 serie');
  await expect(finish.getByRole('button', { name: 'Fatto', exact: true })).toHaveCount(0);
  await expect(finish.getByRole('button', { name: 'Concludi' })).toBeDisabled();
  await finish.getByRole('button', { name: 'Sforzo 8 su 10' }).click();
  await finish.getByRole('button', { name: 'Concludi' }).click();

  // --- Riepilogo ---
  await expect(page.getByRole('heading', { name: 'Spinta finta', level: 1 })).toBeVisible();
  await expect(page.getByText('Riepilogo · LUN 12 OTT 2026')).toBeVisible();
  await expect(page.getByTestId('stat-sets')).toHaveText('4/6');
  await expect(page.getByText('2 saltate')).toBeVisible();
  await expect(page.getByTestId('stat-volume')).toHaveText('460 kg'); // 57,5 × 8; le altre serie a 0 kg
  await expect(page.getByTestId('stat-records')).toHaveText('0');
  await expect(page.getByRole('img', { name: 'Affaticamento muscolare: 5 su 5' })).toBeVisible();
  await expect(page.getByTestId('summary-cardio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sforzo 8 su 10' })).toHaveAttribute('aria-pressed', 'true');
  const lat = page.getByTestId('exercise-summary').nth(1);
  await expect(lat).toContainText('1/3');
  await expect(lat).toContainText('−2 serie');
  await lat.getByRole('button', { expanded: false }).click();
  await expect(lat).toContainText('saltata');
  await expect(lat).toContainText('Spalla sinistra un po’ rigida.');

  // Invia al PT: foglio di condivisione con testo e file .json (simulato).
  await page.getByRole('button', { name: 'Invia al PT' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Riepilogo' })).toHaveText('Riepilogo pronto per il PT.');
  const shared = (await page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)) as {
    files: string[];
    kind: string;
    text: string;
  };
  expect(shared.files).toEqual(['healthy-sessione-spinta-finta-2026-10-12.json']);
  expect(shared.kind).toBe('session');
  expect(shared.text).toContain('2. Lat machine presa larga — 1/3');

  // --- Fine → Home; lo Storico ritrova la sessione dopo aver riaperto l'app (offline) ---
  await page.getByRole('link', { name: 'Fine' }).click();
  // La Home (M6) mostra l'allenamento di oggi come fatto, con il collegamento al Riepilogo.
  const doneCard = page.getByRole('region', { name: 'Allenamento: Spinta finta' });
  await expect(doneCard).toContainText('Fatto ✓');
  await expect(doneCard.getByRole('link', { name: 'Vedi riepilogo' })).toBeVisible();
  await page.goto('./#/allena');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Allenamento in corso' })).toHaveCount(0);
  await expect(page.getByTestId('week-strip').getByRole('button').nth(0)).toHaveAttribute('aria-label', /fatto/i);
  await expect(page.getByTestId('workout-row')).toContainText('ultima: 12 ott');
  await page.getByRole('tab', { name: 'Storico' }).click();
  await expect(page.getByRole('listitem', { name: '12 ottobre, oggi: 1 sessione' })).toBeVisible();
  await expect(page.getByTestId('month-count')).toHaveText('1 sessione');
  const row = page.getByTestId('history-row');
  await expect(row).toContainText('Spinta finta');
  await expect(row).toContainText('460 kg · R20');
  await page.getByRole('button', { name: 'Mese precedente' }).click();
  await expect(page.getByRole('heading', { name: 'Settembre' })).toBeVisible();
  await expect(page.getByText('Nessuna attività a settembre.')).toBeVisible();
  await page.getByRole('button', { name: 'Mese successivo' }).click();
  await expect(page.getByRole('button', { name: 'Mese successivo' })).toBeDisabled();

  // Dallo Storico al Riepilogo e ritorno con lo swipe dal bordo sinistro.
  await row.click();
  await expect(page.getByTestId('stat-sets')).toHaveText('4/6');
  await page.waitForFunction(() => document.getAnimations().length === 0); // fine dell'entrata della schermata
  await page.mouse.move(5, 400);
  await page.mouse.down();
  await page.mouse.move(60, 405, { steps: 4 });
  await page.mouse.move(250, 410, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('tab', { name: 'Storico' })).toHaveAttribute('aria-selected', 'true');

  // Elimina dal Riepilogo (con conferma): sparisce dallo Storico.
  await page.getByTestId('history-row').click();
  await page.getByRole('button', { name: 'Elimina sessione' }).click();
  const del = page.getByRole('dialog', { name: 'Eliminare la sessione?' });
  await del.getByRole('button', { name: 'Annulla' }).click();
  await expect(page.getByTestId('stat-sets')).toBeVisible();
  await page.getByRole('button', { name: 'Elimina sessione' }).click();
  await del.getByRole('button', { name: 'Elimina' }).click();
  await expect(page.getByText('Nessun allenamento ancora')).toBeVisible();
});

test('la seconda volta: "ultima volta", kg precompilati, PR e confronto nel riepilogo', async ({ page }) => {
  await createWorkout(page);
  await startFromAllena(page);
  await page.getByLabel('Chili serie 1').fill('60');
  await check(rows(page).nth(0), 1).click();
  await page.getByRole('button', { name: 'Esercizio successivo' }).click();
  await page.getByRole('button', { name: 'Termina allenamento' }).click();
  const finish = page.getByRole('dialog', { name: 'Termina allenamento' });
  await finish.getByRole('button', { name: 'Sforzo 6 su 10' }).click();
  await finish.getByRole('button', { name: 'Concludi' }).click();
  await expect(page.getByTestId('exercise-summary').nth(0)).toContainText('−2 serie'); // mancano serie: l'avviso ha la precedenza
  await page.goto('./#/allena');

  // Di nuovo la stessa scheda (la card "Prossimo" ora punta a lunedì prossimo).
  await page.clock.fastForward('02:00:00');
  await startFromAllena(page);
  const first = rows(page).nth(0);
  await expect(first.getByRole('cell').nth(1)).toHaveText('60 × 10');
  await expect(page.getByLabel('Chili serie 1')).toHaveValue('60');
  await expect(rows(page).nth(1).getByRole('cell').nth(1)).toHaveText('—');
  await expect(page.getByLabel('Chili serie 2')).toHaveValue('0');

  // 62,5 × 10 > 60 × 10: record.
  await page.getByLabel('Chili serie 1').fill('62,5');
  await page.getByRole('button', { name: 'Spunta tutte le serie' }).click(); // 3/3: nessun avviso, conta il confronto
  await page.getByRole('button', { name: 'Esercizio successivo' }).click();
  await page.getByRole('button', { name: 'Termina allenamento' }).click();
  await finish.getByRole('button', { name: 'Sforzo 7 su 10' }).click();
  await finish.getByRole('button', { name: 'Concludi' }).click();
  await expect(page.getByTestId('stat-records')).toHaveText('1');
  const panca = page.getByTestId('exercise-summary').nth(0);
  await expect(panca.getByText('PR', { exact: true })).toBeVisible();
  await expect(panca).toContainText('+2,5 kg');
  await expect(panca).toContainText('top 62,5 × 10');
  await page.getByRole('link', { name: 'Fine' }).click();
  await page.goto('./#/allena?tab=storico');
  await expect(page.getByTestId('history-row')).toHaveCount(2);
  await expect(page.getByTestId('history-row').first()).toContainText('1 PR');
  await expect(page.getByTestId('month-count')).toHaveText('2 sessioni · 1 PR');
});

test('abbandona la sessione in corso da Allena (con conferma); avvio con una sessione già in corso', async ({ page }) => {
  await createWorkout(page);
  await startFromAllena(page);
  await check(rows(page).nth(0), 1).click();
  await page.getByRole('button', { name: 'Torna alla scheda' }).click();
  await page.getByRole('dialog', { name: 'Uscire dall’allenamento?' }).getByRole('button', { name: 'Esci, la riprendo dopo' }).click();

  // Avvia con una sessione in corso: chiede cosa fare.
  await page.getByRole('region', { name: 'Prossimo allenamento' }).getByRole('button', { name: 'Avvia' }).click();
  const gate = page.getByRole('dialog', { name: 'Allenamento in corso' });
  await expect(gate).toContainText('in corso dalle 18:00');
  await gate.getByRole('button', { name: 'Annulla' }).click();

  const resume = page.getByRole('region', { name: 'Allenamento in corso' });
  await resume.getByRole('button', { name: 'Abbandona' }).click();
  const confirm = page.getByRole('dialog', { name: 'Abbandonare l’allenamento?' });
  await confirm.getByRole('button', { name: 'Continua' }).click();
  await expect(resume).toBeVisible();
  await resume.getByRole('button', { name: 'Abbandona' }).click();
  await confirm.getByRole('button', { name: 'Abbandona' }).click();
  await expect(resume).toHaveCount(0);
  await expect(page.getByTestId('workout-row')).toContainText('mai eseguita');
});

test('sessione live: aree toccabili ≥ 44 px, nessuno scroll orizzontale, banner fermi', async ({ page }) => {
  await createWorkout(page);
  await startFromAllena(page);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a, input, textarea')]
      .filter((el) => el.offsetParent !== null && !el.closest('dialog'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
      .map(({ el }) => el.getAttribute('aria-label') ?? el.textContent?.trim()),
  );
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const header = page.locator('header.banner');
  const before = await header.boundingBox();
  await page.locator('main.body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await header.boundingBox()).toEqual(before);
  await expect(restButton(page)).toBeInViewport();
});
