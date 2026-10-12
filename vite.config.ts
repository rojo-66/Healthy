/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// GitHub Pages serve l'app in https://rojo-66.github.io/Healthy/
// La stessa origine ospita MyDiet: scope e cache restano confinati a questa cartella.
const BASE = '/Healthy/';
const THEME = '#12141a';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: BASE,
  // Versione e build mostrate nel Profilo (Informazioni). In GitHub Actions ci sono numero di esecuzione e commit.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(process.env['GITHUB_RUN_NUMBER'] ?? 'locale'),
    __APP_COMMIT__: JSON.stringify((process.env['GITHUB_SHA'] ?? '').slice(0, 7)),
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      scope: BASE,
      // Le icone in public/ entrano già nel precache tramite globPatterns.
      includeManifestIcons: false,
      manifest: {
        id: BASE,
        name: 'Healthy',
        short_name: 'Healthy',
        description: 'Allenamento e alimentazione, sul tuo telefono.',
        lang: 'it',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: THEME,
        theme_color: THEME,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Le cache precache diventano "healthy-precache-…"; la pulizia di Workbox
        // tocca solo le cache che contengono lo scope di questo service worker.
        cacheId: 'healthy',
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${BASE}index.html`,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
