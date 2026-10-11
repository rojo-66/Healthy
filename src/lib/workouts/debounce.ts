/**
 * Esecuzione ritardata (bozza dell'editor): `schedule` rimanda, `flush` esegue subito ciò che è in attesa
 * (app in background, uscita), `cancel` lo annulla (dopo un salvataggio vero).
 */
export interface Debounced {
  schedule(run: () => void): void;
  flush(): void;
  cancel(): void;
  readonly pending: boolean;
}

export function debounced(delayMs: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let next: (() => void) | null = null;

  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    next = null;
  }

  function flush() {
    const run = next;
    cancel();
    run?.();
  }

  return {
    schedule(run) {
      if (timer !== null) clearTimeout(timer);
      next = run;
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel,
    get pending() {
      return next !== null;
    },
  };
}
