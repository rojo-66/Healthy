import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/Healthy/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // iPhone (390×844) su Chromium: è il motore con supporto completo ai service worker in Playwright.
      name: 'iphone',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    // Il service worker esiste solo nella build di produzione.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/Healthy/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
