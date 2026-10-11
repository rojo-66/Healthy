/**
 * Schermo sempre acceso durante la sessione (Wake Lock API, Safari ≥ 16.4).
 * iOS rilascia il blocco quando l'app va in background: al ritorno (`visibilitychange`) lo si richiede.
 * Se l'API manca o il sistema rifiuta, non succede nulla (nessuna alternativa con video nascosti).
 */

interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface WakeLockEnv {
  navigator: { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

export interface KeepAwake {
  /** Attiva (anche dentro un tocco: alcuni browser lo richiedono la prima volta). */
  start(): Promise<void>;
  /** Disattiva e smette di ascoltare. */
  stop(): void;
  readonly active: boolean;
}

export function createKeepAwake(
  env: WakeLockEnv = { navigator: navigator as unknown as WakeLockEnv['navigator'], document },
): KeepAwake {
  let wanted = false;
  let sentinel: Sentinel | null = null;
  let requesting = false;

  async function request() {
    const api = env.navigator.wakeLock;
    if (!api || !wanted || sentinel || requesting || env.document.visibilityState !== 'visible') return;
    requesting = true;
    try {
      const s = await api.request('screen');
      if (!wanted) {
        void s.release().catch(() => undefined);
        return;
      }
      sentinel = s;
      s.addEventListener('release', () => {
        if (sentinel === s) sentinel = null;
      });
    } catch {
      // Rifiutato (batteria scarica, permessi): lo schermo si spegnerà come al solito.
    } finally {
      requesting = false;
    }
  }

  const onVisibility = () => {
    if (env.document.visibilityState === 'visible') void request();
  };

  return {
    async start() {
      if (!wanted) env.document.addEventListener('visibilitychange', onVisibility);
      wanted = true;
      await request();
    },
    stop() {
      if (wanted) env.document.removeEventListener('visibilitychange', onVisibility);
      wanted = false;
      const s = sentinel;
      sentinel = null;
      if (s) void s.release().catch(() => undefined);
    },
    get active() {
      return sentinel !== null;
    },
  };
}

let shared: KeepAwake | null = null;

/** Unico per l'app: avviato su "Inizia allenamento", fermato all'uscita dal Live. */
export function keepAwake(): KeepAwake {
  shared ??= createKeepAwake();
  return shared;
}
