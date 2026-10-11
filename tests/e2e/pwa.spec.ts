import { expect, test } from '@playwright/test';

test('in Safari mostra l\'avviso di installazione, chiudibile', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Healthy', level: 1 })).toBeVisible();

  const banner = page.getByRole('note');
  await expect(banner).toContainText('Aggiungi alla schermata Home prima di inserire dati');
  await expect(banner).toContainText('memorie separate');

  await page.getByRole('button', { name: 'Ho capito' }).click();
  await expect(banner).toBeHidden();
});

test('il pulsante "Ho capito" è grande almeno 44 px', async ({ page }) => {
  await page.goto('./');
  const box = await page.getByRole('button', { name: 'Ho capito' }).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
});

test('il manifest è limitato alla cartella dell\'app', async ({ page, baseURL }) => {
  const res = await page.request.get(`${baseURL}manifest.webmanifest`);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    name: 'Healthy',
    short_name: 'Healthy',
    start_url: '/Healthy/',
    scope: '/Healthy/',
    display: 'standalone',
    lang: 'it',
  });
});

test('dopo la prima visita si apre offline e usa solo cache healthy-*', async ({ page, context }) => {
  await page.goto('./');
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
  expect(new URL(scope).pathname).toBe('/Healthy/');

  // Il precache avviene durante l'installazione: quando il SW è attivo le risorse sono già in cache.
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.length).toBeGreaterThan(0);
  for (const name of cacheNames) expect(name).toMatch(/^healthy-/);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Healthy', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
});
