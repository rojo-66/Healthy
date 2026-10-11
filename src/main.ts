import { mount } from 'svelte';
import './lib/design/tokens.css';
import './app.css';
import App from './App.svelte';

// Chiede al browser di non cancellare IndexedDB quando lo spazio scarseggia (SPEC § 2).
void navigator.storage?.persist?.().catch(() => false);

// Safari iOS applica :active (feedback alla pressione) solo se esiste un listener touch.
document.addEventListener('touchstart', () => {}, { passive: true });

const target = document.getElementById('app');
if (!target) throw new Error('Elemento #app mancante');

export default mount(App, { target });
