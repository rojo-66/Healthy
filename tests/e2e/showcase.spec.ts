import { expect, test, type Locator, type Page } from '@playwright/test';

async function openShowcase(page: Page) {
  await page.goto('./#/showcase');
  await expect(page.getByRole('heading', { name: 'Componenti', level: 1 })).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('la pagina di prova si apre dall’indirizzo, e il refresh la mantiene', async ({ page }) => {
  // Dal M6 la Home è "Oggi": il link "Componenti (prova)" non c'è più, la pagina resta su #/showcase.
  await page.goto('./');
  await expect(page.getByTestId('home-strip')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Componenti (prova)' })).toHaveCount(0);
  await page.goto('./#/showcase');
  await expect(page.getByRole('heading', { name: 'Componenti', level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Componenti', level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Torna alla Home' }).click();
  await expect(page.getByTestId('home-strip')).toBeVisible();
});

/** Il pannello entra dal fondo: si aspetta che sia fermo prima di afferrarlo. */
async function settled(locator: Locator) {
  let last = -1;
  await expect
    .poll(async () => {
      const y = Math.round((await locator.boundingBox())?.y ?? -1);
      const still = y === last;
      last = y;
      return still;
    })
    .toBe(true);
}

test('BottomSheet: si apre e si chiude con Esc, overlay, ✕ e trascinamento', async ({ page }) => {
  await openShowcase(page);
  const opener = page.getByRole('button', { name: 'Apri recupero' });
  const sheet = page.getByRole('dialog', { name: 'Recupero' });

  // Esc
  await opener.click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Recupero' })).toBeVisible();
  expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');

  // Tocco sull'overlay (zona sopra il pannello)
  await opener.click();
  await expect(sheet).toBeVisible();
  await page.mouse.click(195, 40);
  await expect(sheet).toBeHidden();

  // Pulsante ✕
  await opener.click();
  await sheet.getByRole('button', { name: 'Chiudi' }).last().click();
  await expect(sheet).toBeHidden();

  // Trascinamento verso il basso dalla maniglia
  await opener.click();
  await expect(sheet).toBeVisible();
  const title = sheet.getByRole('heading', { name: 'Recupero' });
  await expect(title).toBeInViewport();
  await settled(title);
  const box = (await title.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + 120, { steps: 6 });
  await page.mouse.move(box.x + 10, box.y + 300, { steps: 6 });
  await page.mouse.up();
  await expect(sheet).toBeHidden();

  // Un trascinamento breve e lento non chiude
  await opener.click();
  await expect(title).toBeInViewport();
  await settled(title);
  const box2 = (await title.boundingBox())!;
  await page.mouse.move(box2.x + 10, box2.y + box2.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + 10, box2.y + 20, { steps: 10 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});

test('con "Riduci movimento" il pannello si apre e si chiude senza animazioni', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openShowcase(page);
  const sheet = page.getByRole('dialog', { name: 'Ottobre 2026' });
  await page.getByRole('button', { name: 'Apri piano (lungo)' }).click();
  await expect(sheet).toBeVisible();
  const duration = await sheet.locator('.panel').evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
  await sheet.getByRole('button', { name: 'Fatto' }).click();
  await expect(sheet).toBeHidden();
});

test('Tabs: tocco e frecce cambiano la scheda attiva e il pannello', async ({ page }) => {
  await openShowcase(page);
  const tablist = page.getByRole('tablist', { name: 'Sezioni dieta' });
  const piano = tablist.getByRole('tab', { name: 'Piano' });
  const spesa = tablist.getByRole('tab', { name: 'Spesa' });
  const ricette = tablist.getByRole('tab', { name: 'Ricette' });

  await expect(piano).toHaveAttribute('aria-selected', 'true');
  await spesa.click();
  await expect(spesa).toHaveAttribute('aria-selected', 'true');
  await expect(piano).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('tabpanel', { name: 'Spesa' })).toContainText('Lista della spesa');

  await page.keyboard.press('ArrowRight');
  await expect(ricette).toHaveAttribute('aria-selected', 'true');
  await expect(ricette).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(piano).toHaveAttribute('aria-selected', 'true');
});

test('Stepper: + e − cambiano il valore nei limiti, passo 2,5 con la virgola', async ({ page }) => {
  await openShowcase(page);
  const kg = page.getByRole('group', { name: 'Kg' });
  await expect(kg.getByRole('spinbutton')).toHaveValue('72,5');
  await kg.getByRole('button', { name: 'Più 2,5 kg' }).click();
  await expect(kg.getByRole('spinbutton')).toHaveValue('75');
  await kg.getByRole('button', { name: 'Meno 2,5 kg' }).click();
  await kg.getByRole('button', { name: 'Meno 2,5 kg' }).click();
  await expect(kg.getByRole('spinbutton')).toHaveValue('70');

  const sets = page.getByRole('group', { name: 'Serie' });
  const more = sets.getByRole('button', { name: 'Una serie in più' });
  for (let i = 0; i < 6; i++) await more.click();
  await expect(sets.getByRole('spinbutton')).toHaveValue('10');
  await expect(more).toBeDisabled();

  await expect(page.getByRole('group', { name: 'Al massimo' }).getByRole('button', { name: 'Più 1' })).toBeDisabled();
});

test('CheckButton: la spunta cambia aria-pressed', async ({ page }) => {
  await openShowcase(page);
  const check = page.getByRole('button', { name: 'Segna serie 1 come fatta' });
  await expect(check).toHaveAttribute('aria-pressed', 'false');
  await check.click();
  await expect(check).toHaveAttribute('aria-pressed', 'true');
});

test('nessuno scroll orizzontale e controlli di almeno 44 px', async ({ page }) => {
  await page.goto('./');
  await expectNoHorizontalScroll(page);

  await openShowcase(page);
  await expectNoHorizontalScroll(page);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a[href], [role="tab"]')]
      .filter((el) => el.offsetParent !== null && !el.classList.contains('overlay'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.getAttribute('aria-label') ?? el.textContent?.trim(), w: r.width, h: r.height };
      })
      .filter((b) => b.w < 44 || b.h < 44),
  );
  expect(small).toEqual([]);
});

test('i font sono nel precache e funzionano offline', async ({ page, context, baseURL }) => {
  const sw = await (await page.request.get(`${baseURL}sw.js`)).text();
  for (const font of ['permanent-marker-latin-400', 'space-grotesk-latin-400', 'jetbrains-mono-latin-700']) {
    expect(sw).toMatch(new RegExp(`${font}-normal-[\\w-]+\\.woff2`));
  }
  expect(sw).not.toMatch(/\.woff"/);

  await openShowcase(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Componenti', level: 1 })).toBeVisible();

  const loaded = await page.evaluate(async () => {
    const specs = ['16px "Permanent Marker"', '16px "Space Grotesk"', '700 16px "JetBrains Mono"'];
    const faces = await Promise.all(specs.map((s) => document.fonts.load(s)));
    return faces.map((f) => f.length > 0 && f.every((face) => face.status === 'loaded'));
  });
  expect(loaded).toEqual([true, true, true]);
});
