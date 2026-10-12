/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/svelte" />
/// <reference types="vite-plugin-pwa/info" />

/** Versione dell'app (package.json), numero di build e commit (GitHub Actions; "locale" fuori da CI). */
declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;
declare const __APP_COMMIT__: string;
