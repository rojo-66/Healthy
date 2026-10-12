/** Versione e build dell'app (iniettate da Vite, vedi `vite.config.ts`). Nessuna rete, nessun tracciamento. */
export interface AppInfo {
  version: string;
  build: string;
  commit: string;
}

export const APP_INFO: AppInfo = { version: __APP_VERSION__, build: __APP_BUILD__, commit: __APP_COMMIT__ };

/** "Versione 0.7.0 · build 42 (1a2b3c4)"; fuori da GitHub Actions "build locale". */
export function versionLabel(info: AppInfo = APP_INFO): string {
  const commit = info.commit ? ` (${info.commit})` : '';
  return `Versione ${info.version} · build ${info.build}${commit}`;
}
