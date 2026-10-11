import { parseHash } from './routes';

export const route = $state({ path: parseHash(location.hash) ?? '/' });

window.addEventListener('hashchange', () => {
  const path = parseHash(location.hash);
  if (path === null || path === route.path) return;
  route.path = path;
  window.scrollTo(0, 0);
});
