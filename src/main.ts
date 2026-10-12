// Prima di tutto (anche del router): un link di condivisione `#import=…` non è una rotta (SPEC § 8.4).
import './lib/share/import/boot';
import { mount } from 'svelte';
import './lib/design/fonts';
import './lib/design/tokens.css';
import './app.css';
import './lib/design/motion.css';
import App from './App.svelte';
import { initViewport } from './lib/design/viewport.svelte';

// Chiede al browser di non cancellare IndexedDB quando lo spazio scarseggia (SPEC § 2) e salva l'esito.
// Import dinamico: Dexie e zod non rallentano il primo disegno della pagina.
void import('./lib/data/storage').then(({ initStorage }) => initStorage()).catch(() => null);
// Libreria esercizi nel database (idempotente: scrive solo ciò che manca o è cambiato).
void import('./lib/workouts/library/sync').then(({ syncLibrary }) => syncLibrary()).catch(() => null);

// Altezza reale dello schermo e scroll a posto dopo tastiera e background (SPEC § 10).
initViewport();

// Safari iOS applica :active (feedback alla pressione) solo se esiste un listener touch.
document.addEventListener('touchstart', () => {}, { passive: true });

const target = document.getElementById('app');
if (!target) throw new Error('Elemento #app mancante');

export default mount(App, { target });
