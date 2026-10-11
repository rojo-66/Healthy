/** Sottoinsieme di `window` usato qui: permette di testare con oggetti finti. */
export interface DisplayEnv {
  matchMedia(query: string): { matches: boolean };
  navigator: NavigatorLike;
}

export interface NavigatorLike {
  userAgent: string;
  maxTouchPoints?: number;
  /** Solo Safari iOS: true quando l'app è aperta dalla schermata Home. */
  standalone?: boolean;
}

/** L'app è aperta come app installata (dall'icona in Home) e non in una scheda del browser. */
export function isStandalone(env: DisplayEnv): boolean {
  return env.matchMedia('(display-mode: standalone)').matches || env.navigator.standalone === true;
}

/** iPhone, iPod o iPad (iPadOS si presenta come Mac, ma ha il touch). */
export function isIos(nav: NavigatorLike): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return /Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1;
}
