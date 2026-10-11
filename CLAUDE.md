# Healthy App – istruzioni per Claude Code

App personale (io + pochi amici, tutti con **iPhone**) che unisce **allenamento** e **alimentazione**.
È una **PWA local-first** pubblicata su **GitHub Pages**: nessun server, nessun account, costo zero, funziona offline.

La specifica completa è in `docs/SPEC.md`: **leggila prima di qualsiasi lavoro**.
I mockup approvati sono in `docs/mockups/` (vedi `docs/mockups/README.md`).

## Stack
- Vite + **Svelte 5** + **TypeScript** (strict)
- **Dexie** (IndexedDB) per i dati, **zod** per validare ogni dato importato
- **vite-plugin-pwa** (Workbox) per offline e installazione
- Font self-hosted con `@fontsource` (Permanent Marker, Space Grotesk, JetBrains Mono): niente CDN, l'app deve funzionare offline
- Grafici in **SVG fatto a mano** (niente librerie pesanti)
- Test: **Vitest** per la logica, **Playwright** (viewport iPhone 390×844) per i flussi principali
- Deploy: GitHub Actions → GitHub Pages

## Comandi
- `npm run dev` – sviluppo locale
- `npm run build` – build di produzione
- `npm run preview` – prova la build (con service worker)
- `npm test` – test unitari
- `npm run test:e2e` – test Playwright

## Regole del progetto
- **Interfaccia in italiano**. Nomi di codice, variabili e file in inglese.
- **Nessun backend.** Niente servizi a pagamento, niente chiavi API, niente tracciamento.
- **I dati personali non vanno mai nel repository** (il repo è pubblico). La cartella `private/` è in `.gitignore`: lì si possono tenere file di prova reali (dieta, PDF). Nei test usa solo dati finti in `tests/fixtures/`.
- **Convivenza con MyDiet**: l'app MyDiet vive sulla stessa origine (`rojo-66.github.io`). Quindi:
  - nome database IndexedDB: `healthy-app`;
  - nomi cache con prefisso `healthy-`; il service worker **cancella solo le proprie cache**, mai le altre;
  - scope del service worker limitato alla cartella dell'app (`/<nome-repo>/`).
- **Tutto ciò che arriva dall'esterno** (file, link di condivisione, QR) va validato con zod e mostrato come testo, mai come HTML.
- **Colori con significato fisso**: magenta = allenamento, verde acido = alimentazione, ciano = progressi/navigazione, giallo = consigli e note di PT/app. Token in `src/lib/design/tokens.css`.
- **Animazioni**: solo `transform` e `opacity`; rispetta sempre `prefers-reduced-motion`. Ogni elemento toccabile ha un feedback visivo (su iPhone il web non può vibrare). Unica eccezione voluta: gli anelli SVG (`ProgressRing`) animano `stroke-dashoffset`. Utility in `src/lib/design/motion.css`, transizioni Svelte in `src/lib/design/transitions.ts`; mai "classe di animazione + key" (duplica gli elementi).
- **Design system**: componenti in `src/lib/components/` (pagina di prova `#/showcase`). Il colore di sezione si passa con `tone` (`training` / `food` / `progress` / `tip`), mai con colori scritti a mano.
- **Accessibilità**: aree toccabili ≥ 44 px, `<button>`/`<a>` veri, `aria-label` sui pulsanti con sola icona, contrasto testo ≥ 4.5:1.
- **iPhone**: usa `100dvh`, `env(safe-area-inset-*)`, Wake Lock durante la sessione; niente funzioni che Safari non supporta senza un'alternativa.

## Come lavorare
1. Lavora **una milestone alla volta** (elenco in `docs/SPEC.md` § 12). Prima proponi un piano, poi implementa.
2. Per ogni schermata, apri il mockup corrispondente in `docs/mockups/` e rispetta layout, colori, testi e animazioni.
3. A fine milestone: test verdi, `npm run build` senza errori, aggiorna la sezione **Stato** in fondo a `docs/SPEC.md`.
4. Se una decisione non è coperta dalla specifica, chiedi invece di inventare.
