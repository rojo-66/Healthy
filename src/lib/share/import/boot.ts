import { interceptImportHash } from './pending.svelte';

// Primo import di main.ts: gira prima che il router legga `location.hash` (SPEC § 8.4).
interceptImportHash();
