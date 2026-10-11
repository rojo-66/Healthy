import { parseHash, parseQuery } from './routes';

/**
 * Rotta corrente. `nav` cresce a ogni navigazione vera (cambio di hash): le pagine con parametri
 * si ricreano su `nav`, non sui parametri, così `replaceRoute` può correggere l'indirizzo senza ricrearle.
 */
export const route = $state({ path: parseHash(location.hash) ?? '/', query: parseQuery(location.hash), nav: 0 });

window.addEventListener('hashchange', () => {
  const path = parseHash(location.hash);
  if (path === null) return;
  const query = parseQuery(location.hash);
  if (path === route.path && JSON.stringify(query) === JSON.stringify(route.query)) return;
  route.path = path;
  route.query = query;
  route.nav++;
  window.scrollTo(0, 0);
});

/**
 * Sostituisce l'indirizzo senza navigare (niente nuova voce nella cronologia, pagina non ricreata):
 * es. l'editor di una scheda nuova, dopo il salvataggio, mostra `?id=` della scheda salvata.
 */
export function replaceRoute(hash: string): void {
  history.replaceState(history.state, '', hash);
  route.path = parseHash(hash) ?? '/';
  route.query = parseQuery(hash);
}
