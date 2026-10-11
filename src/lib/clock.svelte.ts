/**
 * Orologio delle schermate "a giorno" (Home, Dieta, Allena): decide "oggi" e il pasto del momento.
 * Si aggiorna a intervalli, alla mezzanotte e quando l'app torna in primo piano: su iPhone l'app
 * installata resta aperta a lungo e iOS sospende i timer in background.
 */

/** Millisecondi fino a un secondo dopo la prossima mezzanotte locale (anche nei giorni del cambio d'ora). */
export function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

export interface NowClock {
  readonly current: Date;
}

/** Ora corrente reattiva. Va chiamata durante l'inizializzazione di un componente. */
export function nowClock(tickMs = 30_000): NowClock {
  let now = $state.raw(new Date());

  $effect(() => {
    let midnight: ReturnType<typeof setTimeout> | undefined;
    // Mai leggere `now` qui dentro: l'effetto dipenderebbe da sé stesso e ripartirebbe a ogni scrittura.
    const refresh = () => {
      const current = new Date();
      now = current;
      clearTimeout(midnight);
      midnight = setTimeout(refresh, msUntilNextMidnight(current));
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    const timer = setInterval(() => (now = new Date()), tickMs);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      clearInterval(timer);
      clearTimeout(midnight);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  });

  return {
    get current() {
      return now;
    },
  };
}
