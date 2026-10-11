/**
 * Rotte con hash (`#/showcase`): su GitHub Pages il refresh non dà mai 404.
 * Solo gli hash che iniziano con `#/` sono rotte: `#import=…` (SPEC § 8.4) resta libero.
 */
export type RoutePath =
  | '/'
  | '/showcase'
  | '/dev-data'
  | '/dieta'
  | '/dieta/completa'
  | '/allena'
  | '/allena/editor'
  | '/allena/vedi'
  | '/sessione/readiness'
  | '/sessione/intro'
  | '/sessione/live'
  | '/sessione/riepilogo';

const KNOWN: readonly string[] = [
  '/',
  '/showcase',
  '/dev-data',
  '/dieta',
  '/dieta/completa',
  '/allena',
  '/allena/editor',
  '/allena/vedi',
  '/sessione/readiness',
  '/sessione/intro',
  '/sessione/live',
  '/sessione/riepilogo',
];

/** Rotta corrispondente a un hash; `null` se l'hash non è una rotta (es. `#import=…`). Sconosciuta → Home. */
export function parseHash(hash: string): RoutePath | null {
  if (hash === '' || hash === '#') return '/';
  if (!hash.startsWith('#/')) return null;
  const path = (hash.slice(1).split('?')[0] ?? '').replace(/\/+$/, '') || '/';
  return KNOWN.includes(path) ? (path as RoutePath) : '/';
}

/** Parametri dopo `?` nell'hash (`#/allena/editor?id=…` → `{ id: '…' }`). Sono testo: chi li usa li valida. */
export function parseQuery(hash: string): Readonly<Record<string, string>> {
  const at = hash.indexOf('?');
  if (!hash.startsWith('#/') || at === -1) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(hash.slice(at + 1))) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

/** Hash di una rotta con parametri (valori codificati). */
export function routeHref(path: RoutePath, query: Readonly<Record<string, string | undefined>> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, value);
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}
