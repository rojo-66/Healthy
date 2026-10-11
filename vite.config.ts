/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serve l'app in https://rojo-66.github.io/Healthy/
// La stessa origine ospita MyDiet: scope e cache restano confinati a questa cartella.
const BASE = '/Healthy/';
const THEME = '#12141a';

export default defineConfig({
  base: BASE,
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
  },
});
