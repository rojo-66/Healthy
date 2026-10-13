import { expect, test, type Page } from '@playwright/test';

/**
 * Passo 2a: cardio come esercizio della scheda (libreria, editor, sessione live con cronometro, riepilogo)
 * e corsa come attività (crea, segna come fatta da Home e Allena, Storico in ciano). Tutto anche offline.
 * Lunedì 12 ottobre 2026, 18:00; orologio simulato.
 */
const NOW = new Date(2026, 9, 12, 18, 0);
const OLD_BACKUP = 'tests/fixtures/home/backup-workouts-only.json';
const LEGACY_WORKOUT_FILE = 'tests/fixtures/legacy/share/workout-typical.json';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

const exerciseName = (page: Page) => page.getByRole('region', { name: 'Esercizio in corso' }).getByRole('heading', { level: 2 });

async function goOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('cardio come esercizio: libreria, editor, riordino, sessione con cronometro e avviso, riepilogo, offline', async ({ page }) => {
  await page.goto('./#/allena/editor');
  await page.getByLabel('Nome della scheda').fill('Cardio e panca');
  await page.getByRole('button', { name: 'Lunedì' }).click();

  // Forza dalla libreria.
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  let lib = page.getByRole('dialog', { name: 'Libreria' });
  await lib.getByLabel('Cerca esercizio').fill('panca piana');
  await lib.getByRole('button', { name: 'Aggiungi Panca piana con bilanciere', exact: true }).click();
  await expect(lib).toBeHidden();

  // Cardio dalla libreria: chip "Cardio", ricerca, aggiunta.
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  lib = page.getByRole('dialog', { name: 'Libreria' });
  await lib.getByRole('button', { name: 'Cardio', exact: true }).click();
  await expect(lib.getByRole('status')).toHaveText('18 esercizi');
  await lib.getByLabel('Cerca esercizio').fill('tapis');
  await expect(lib.getByRole('status')).toHaveText('2 esercizi');
  await lib.getByRole('button', { name: 'Aggiungi Tapis roulant · corsa', exact: true }).click();
  await expect(lib).toBeHidden();

  const cardioRow = page.locator('[data-testid="exercise-row"][data-kind="cardio"]');
  await expect(cardioRow).toContainText('cardio · 10′');
  // Niente serie né kg: minuti e i campi della voce (distanza, velocità, pendenza).
  await expect(cardioRow.getByRole('button', { name: 'Una serie in più' })).toHaveCount(0);
  await cardioRow.getByRole('button', { name: 'Un minuto in più' }).click();
  await cardioRow.getByRole('button', { name: 'Un minuto in più' }).click();
  await cardioRow.getByRole('button', { name: 'Distanza: più 0.5' }).click();
  await cardioRow.getByRole('button', { name: 'Distanza: più 0.5' }).click();
  await expect(cardioRow).toContainText('cardio · 12′ · 1 km');
  await expect(cardioRow.getByRole('button', { name: /Altri campi \(1\)/ })).toBeVisible();

  // Riordino: il cardio va prima della panca.
  await cardioRow.getByRole('button', { name: /^↑ Su/ }).click();
  await expect(page.getByTestId('exercise-row').first()).toHaveAttribute('data-kind', 'cardio');
  await noHorizontalScroll(page);

  // Anteprima e salvataggio.
  await page.getByRole('button', { name: 'Salva e invia' }).click();
  const share = page.getByRole('dialog', { name: /^Condividi «/ });
  await share.getByRole('button', { name: 'Chiudi' }).last().click();
  await page.getByRole('button', { name: 'Torna alle schede' }).click();
  // 3 × (90 + 45) s = 6,75′ → 7′, più 12′ di cardio.
  await expect(page.getByTestId('workout-row')).toContainText('1 esercizio · 3 serie · ~19’');

  // Sessione offline.
  await goOffline(page);
  await page.getByRole('region', { name: 'Prossimo allenamento' }).getByRole('button', { name: 'Avvia' }).click();
  for (const label of ['Sonno', 'Umore', 'Energia', 'Stress', 'Affaticamento muscolare']) {
    await page.getByRole('button', { name: `${label}: 4 su 5` }).click();
  }
  await page.getByRole('button', { name: /^Avanti/ }).click();
  await expect(page.getByTestId('intro-chips')).toContainText('+ 12’ cardio');
  await page.getByRole('button', { name: 'Inizia allenamento' }).click();

  // Primo esercizio: il cardio, con il blocco al posto della tabella delle serie.
  await expect(exerciseName(page)).toHaveText('Tapis roulant · corsa');
  const block = page.getByTestId('cardio-block');
  await expect(block).toContainText('12′ · 1 km');
  await expect(page.getByTestId('set-row')).toHaveCount(0);
  await expect(block.getByRole('timer')).toHaveText('00:00');
  await block.getByTestId('cardio-start').click();
  await page.clock.fastForward('11:58');
  await expect(block.getByRole('timer')).toHaveText(/^11:5\d$/);
  await page.clock.runFor(3000);
  await expect(page.getByTestId('rest-announce')).toHaveText('Tempo previsto raggiunto');
  await expect(block).toContainText('TEMPO PREVISTO RAGGIUNTO');

  // Il cronometro continua; "Fatto" lo ferma e riempie i minuti; nessun recupero.
  await page.clock.fastForward('01:00');
  await block.getByRole('button', { name: 'Segna Tapis roulant · corsa come fatto' }).click();
  await expect(block.getByRole('textbox').first()).toHaveValue('13');
  await expect(page.getByTestId('rest-button')).toHaveAttribute('aria-label', /pronto/);
  await block.getByRole('textbox').nth(1).fill('2,1');

  // Ricarica: il cardio resta segnato con i suoi valori.
  await page.waitForTimeout(400);
  await page.reload();
  await expect(exerciseName(page)).toHaveText('Tapis roulant · corsa');
  await expect(page.getByTestId('cardio-block').getByRole('textbox').nth(1)).toHaveValue('2,1');

  // Secondo esercizio e fine.
  await page.getByRole('button', { name: 'Esercizio successivo' }).click();
  await expect(exerciseName(page)).toHaveText('Panca piana con bilanciere');
  await page.getByRole('button', { name: 'Termina allenamento' }).click();
  const finish = page.getByRole('dialog', { name: 'Termina allenamento' });
  await expect(finish).toContainText('Mancano 3 serie');
  await expect(finish).not.toContainText('cardio non segnat');
  await finish.getByRole('button', { name: 'Sforzo 6 su 10' }).click();
  await finish.getByRole('button', { name: 'Concludi' }).click();

  await expect(page.getByTestId('summary-cardio')).toContainText('Cardio · Tapis roulant · corsa');
  await expect(page.getByTestId('summary-cardio')).toContainText('13′ · 2,1 km ✓');
  await expect(page.getByTestId('stat-sets')).toHaveText('0/3');
  await noHorizontalScroll(page);
});

test('corsa come attività: crea, segna come fatta dalla Home e da Allena, Storico ciano, modifica ed elimina, offline', async ({ page }) => {
  await page.goto('./#/allena');
  await goOffline(page);

  await page.getByRole('link', { name: 'Oppure crea una corsa' }).click();
  await expect(page.getByRole('heading', { name: 'Nuova corsa', level: 1 })).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).fill('Corsa lenta');
  await page.getByRole('button', { name: 'Lunedì' }).click();
  await page.getByRole('button', { name: 'Mercoledì' }).click();
  // Senza obiettivo non si salva.
  await page.getByRole('button', { name: 'Salva corsa' }).click();
  await expect(page.getByText('Indica almeno un obiettivo: minuti o km.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Minuti' }).fill('30');
  await page.getByRole('textbox', { name: 'Km' }).fill('5');
  await page.getByRole('button', { name: 'Salva corsa' }).click();

  await expect(page.getByRole('heading', { name: 'Allena', level: 1 })).toBeVisible();
  await expect(page.getByText('Corsa «Corsa lenta» creata.')).toBeVisible();
  const runRow = page.getByTestId('run-row');
  await expect(runRow).toContainText('obiettivo 30′ · 5 km');
  await expect(runRow).toContainText('LUN · MER');
  await expect(page.getByTestId('week-strip').getByRole('button').first()).toHaveAttribute('aria-label', /corsa Corsa lenta/);

  // Home di oggi: card della corsa → "Segna come fatta".
  await page.getByRole('link', { name: 'Oggi' }).click();
  const card = page.getByRole('region', { name: 'Corsa: Corsa lenta' });
  await expect(card).toContainText('obiettivo 30′ · 5 km');
  await card.getByRole('button', { name: 'Segna come fatta' }).click();
  const sheet = page.getByRole('dialog', { name: 'Corsa lenta' });
  await expect(sheet).toContainText('Obiettivo 30′ · 5 km');
  await sheet.getByRole('button', { name: /Salva corsa/ }).click();
  await expect(sheet).toContainText('Scrivi la durata');
  await sheet.getByLabel('Minuti').fill('32');
  await sheet.getByLabel('Secondi').fill('10');
  await sheet.getByLabel(/Distanza/).fill('5,2');
  await expect(page.getByTestId('run-pace')).toHaveText('PASSO 6:11 /km');
  await sheet.getByRole('button', { name: 'Sforzo 6 su 10' }).click();
  await sheet.getByRole('button', { name: /Salva corsa/ }).click();
  await expect(sheet).toBeHidden();
  await expect(card).toContainText('Fatta ✓');
  await expect(card.getByTestId('run-meta')).toHaveText('32:10 · 5,2 km · 6:11/km · RPE 6');
  await expect(page.getByTestId('timeline')).toContainText('Corsa · Corsa lenta');

  // Storico in ciano con distanza e passo; modifica ed elimina.
  await page.goto('./#/allena?tab=storico');
  await expect(page.getByTestId('month-count')).toHaveText('0 sessioni · 1 corsa');
  await expect(page.getByRole('listitem', { name: '12 ottobre, oggi: 1 corsa' })).toBeVisible();
  const runHistory = page.getByTestId('history-run');
  await expect(runHistory).toContainText('Corsa lenta');
  await expect(runHistory).toContainText('32:10 · 5,2 km · 6:11/km · RPE 6');
  await runHistory.click();
  const detail = page.getByRole('dialog', { name: 'Corsa lenta' });
  await detail.getByRole('button', { name: 'Modifica' }).click();
  await detail.getByLabel(/Distanza/).fill('6');
  await detail.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(runHistory).toContainText('6 km · 5:22/km');
  await runHistory.click();
  await detail.getByRole('button', { name: 'Elimina', exact: true }).click();
  await detail.getByRole('button', { name: 'Elimina davvero' }).click();
  await expect(page.getByTestId('history-run')).toHaveCount(0);

  // Da Allena: "Segna fatta" sulla riga della corsa.
  await page.getByRole('tab', { name: 'Schede' }).click();
  await page.getByTestId('run-row').getByRole('button', { name: /Segna/ }).click();
  await sheet.getByLabel('Minuti').fill('25');
  await sheet.getByRole('button', { name: 'Sforzo 4 su 10' }).click();
  await sheet.getByRole('button', { name: /Salva corsa/ }).click();
  await expect(page.getByText(/Corsa segnata ✓ 25:00 · RPE 4/)).toBeVisible();
  await expect(page.getByTestId('week-strip').getByRole('button').first()).toHaveAttribute('aria-label', /fatto/i);

  // "+ Nuova" propone Scheda o Corsa.
  await page.getByRole('button', { name: '+ Nuova' }).click();
  const choice = page.getByRole('dialog', { name: 'Cosa vuoi creare?' });
  await expect(choice.getByRole('button', { name: /Scheda/ })).toBeVisible();
  await expect(choice.getByRole('button', { name: /Corsa/ })).toBeVisible();
  await noHorizontalScroll(page);
});

test('dati di prima: un backup vecchio con il cardio finale lo mostra come esercizio; una scheda v1 si importa', async ({ page }) => {
  await page.goto('./#/profilo');
  await page.getByTestId('backup-input').setInputFiles(OLD_BACKUP);
  const sheet = page.getByRole('dialog', { name: 'Sostituire i dati?' });
  await sheet.getByRole('button', { name: 'Sostituisci i dati' }).click();
  await expect(sheet).toBeHidden();

  // Home di lunedì: la scheda con il vecchio cardio finale ora ha il cardio come ultimo esercizio.
  await page.goto('./#/');
  await expect(page.getByText('+ 12’ Tapis roulant · corsa').first()).toBeVisible();

  // Scheda condivisa nel formato v1 (prima del 2a): si legge e si importa.
  await page.goto('./#/importa?da=allena');
  await page.getByTestId('import-file').setInputFiles(LEGACY_WORKOUT_FILE);
  await expect(page.getByTestId('import-preview')).toBeVisible();
  await expect(page.getByText('cardio · 12′').first()).toBeVisible();
});
