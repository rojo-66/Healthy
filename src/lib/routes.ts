/**
 * Rotte con hash (`#/showcase`): su GitHub Pages il refresh non dà mai 404.
 * Solo gli hash che iniziano con `#/` sono rotte: `#import=…` (SPEC § 8.4) resta libero.
 */
export type RoutePath = '/' | '/showcase' | '/dev-data';

const KNOWN: readonly string[] = ['/', '/showcase', '/dev-data'];

/** Rotta corrispondente a un hash; `null` se l'hash non è una rotta (es. `#import=…`). Sconosciuta → Home. */
export function parseHash(hash: string): RoutePath | null {
  if (hash === '' || hash === '#') return '/';
  if (!hash.startsWith('#/')) return null;
  const path = (hash.slice(1).split('?')[0] ?? '').replace(/\/+$/, '') || '/';
  return KNOWN.includes(path) ? (path as RoutePath) : '/';
}
